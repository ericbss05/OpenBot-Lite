import type {
  Agent,
} from "./agent";

import type {
  LLMMessage,
  LLMToolCall,
  LLMProvider,
} from "./llm/provider";

import {
  isUserInteractionToolCall,
  parseUserInteraction,
} from "./interactions/user-interaction";

import type {
  ToolRegistry,
} from "./tools/tools";

import type {
  AgentRuntime,
  RuntimeToolExecution,
} from "./runtime/runtime";

import type {
  AgentEventSink,
  RunContext,
} from "./events/events";

import {
  RuntimeHistory,
} from "./runtime/history";

import type {
  RuntimeState,
} from "./runtime/state";

export type ConversationStatus =
  | "completed"
  | "waiting"
  | "failed";

export interface ConversationState {
  agent: Agent;
  context: RunContext;
  history: LLMMessage[];
  runtimeState: RuntimeState;
}

export interface ConversationResult {
  status: ConversationStatus;

  runId: string;

  content?: string;

  error?: string;

  pendingApprovalId?: string;

  pendingToolCall?: LLMToolCall;

  pendingInteraction?: RuntimeState["pendingInteraction"];

  pendingHumanControl?: RuntimeState["pendingHumanControl"];

  state: ConversationState;
}

function createConversationState(
  agent: Agent,
  context: RunContext,
  runtimeState: RuntimeState,
): ConversationState {
  return {
    agent,
    context,
    history: runtimeState.messages,
    runtimeState,
  };
}

function createWaitingResult(
  state: ConversationState,
): ConversationResult {
  return {
    status: "waiting",

    runId: state.context.runId,

    pendingApprovalId:
      state.runtimeState.pendingApprovalId,

    pendingToolCall:
      state.runtimeState.pendingToolCall,

    pendingInteraction:
      state.runtimeState.pendingInteraction,

    pendingHumanControl:
      state.runtimeState.pendingHumanControl,

    state,
  };
}

function createFailedResult(
  state: ConversationState,
): ConversationResult {
  return {
    status: "failed",

    runId: state.context.runId,

    error:
      state.runtimeState.error ??
      "Conversation failed.",

    state,
  };
}

function createCompletedResult(
  state: ConversationState,
): ConversationResult {
  return {
    status: "completed",

    runId: state.context.runId,

    content:
      state.runtimeState.result,

    state,
  };
}

function isHumanControlRequestOutput(
  output: unknown,
): output is {
  type: "human_control_requested";
  reason: string;
  message: string;
} {
  if (
    typeof output !== "object" ||
    output === null
  ) {
    return false;
  }

  const value =
    output as Record<
      string,
      unknown
    >;

  return (
    value.type ===
      "human_control_requested" &&
    typeof value.reason ===
      "string" &&
    typeof value.message ===
      "string"
  );
}

export class AgentConversation {
  constructor(
    private readonly llm: LLMProvider,

    private readonly tools: ToolRegistry,

    private readonly runtime: AgentRuntime,

    private readonly events?: AgentEventSink,

    private readonly maxTurns = 10,
  ) {}

  async run(
    agent: Agent,
    messages: LLMMessage[],
    context: RunContext,
  ): Promise<ConversationResult> {
    if (
      messages.length === 0
    ) {
      throw new Error(
        "Cannot run conversation without messages.",
      );
    }

    if (
      context.agentId !==
      agent.id
    ) {
      throw new Error(
        "RunContext agentId does not match the conversation agent.",
      );
    }

    const history =
      new RuntimeHistory([
        ...messages,
      ]);

    const runtimeState:
      RuntimeState = {
        runId:
          context.runId,

        context,

        agent,

        status:
          "pending",

        messages:
          [...messages],

        turn: 0,

        maxTurns:
          this.maxTurns,

        toolResults: [],
      };

    return this.continueConversation(
      agent,
      context,
      history,
      runtimeState,
    );
  }

  async resume(
    state: ConversationState,
    decision:
      | "approved"
      | "rejected",
  ): Promise<ConversationResult> {
    const pendingToolCall =
      state.runtimeState
        .pendingToolCall;

    if (!pendingToolCall) {
      throw new Error(
        "No pending tool call in conversation state.",
      );
    }

    const runtimeState =
      await this.runtime.resume(
        state.runtimeState,
        decision,
      );

    const history =
      new RuntimeHistory(
        state.history,
      );

    if (
      decision ===
      "rejected"
    ) {
      history.addToolResult(
        pendingToolCall.id,
        pendingToolCall.toolId,
        {
          error:
            "Tool execution rejected by the user.",
        },
      );

      runtimeState.pendingApprovalId =
        undefined;

      runtimeState.pendingToolCall =
        undefined;

      runtimeState.messages =
        history.getMessages();

      return this.continueConversation(
        state.agent,
        state.context,
        history,
        runtimeState,
      );
    }

    const lastToolResult =
      runtimeState.toolResults[
        runtimeState.toolResults.length -
          1
      ];

    if (!lastToolResult) {
      throw new Error(
        "Approved tool produced no result.",
      );
    }

    const content =
      lastToolResult.status ===
      "success"
        ? lastToolResult.output
        : {
            error:
              lastToolResult.error,
          };

    history.addToolResult(
      pendingToolCall.id,
      pendingToolCall.toolId,
      content,
    );

    runtimeState.pendingApprovalId =
      undefined;

    runtimeState.pendingToolCall =
      undefined;

    runtimeState.messages =
      history.getMessages();

    return this.continueConversation(
      state.agent,
      state.context,
      history,
      runtimeState,
    );
  }

  async resumeUserInteraction(
    state: ConversationState,
    answer: string,
  ): Promise<ConversationResult> {
    const runtimeState =
      this.runtime.applyUserInteractionAnswer(
        state.runtimeState,
        answer,
      );

    const history =
      new RuntimeHistory(
        runtimeState.messages,
      );

    return this.continueConversation(
      state.agent,
      state.context,
      history,
      runtimeState,
    );
  }

  /**
   * Reprend une conversation suspendue parce que
   * l'utilisateur devait prendre le contrôle de l'ordinateur.
   *
   * Le RuntimeState contient déjà :
   *
   * - le runId ;
   * - le contexte ;
   * - l'agent ;
   * - les messages ;
   * - le pendingHumanControl ;
   * - le sandbox E2B via l'état persistant de l'agent.
   *
   * On délègue donc directement au RuntimeLoop.
   */
  async resumeHumanControl(
    state: ConversationState,
  ): Promise<ConversationResult> {
    if (
      !state.runtimeState
        .pendingHumanControl
    ) {
      throw new Error(
        "Conversation has no pending human control request.",
      );
    }

    if (
      state.runtimeState.status !==
      "waiting"
    ) {
      throw new Error(
        `Cannot resume human control from runtime status "${state.runtimeState.status}".`,
      );
    }

    console.log(
      "[AGENT CONVERSATION] Resuming human control",
      {
        runId:
          state.context.runId,

        toolCallId:
          state.runtimeState
            .pendingHumanControl
            .toolCallId,
      },
    );

    const runtimeState =
      await this.runtime.resumeHumanControl(
        state.runtimeState,
      );

    const nextState =
      createConversationState(
        state.agent,
        state.context,
        runtimeState,
      );

    console.log(
      "[AGENT CONVERSATION] Human control resumed",
      {
        runId:
          state.context.runId,

        status:
          runtimeState.status,

        turn:
          runtimeState.turn,

        pendingApprovalId:
          runtimeState.pendingApprovalId ??
          null,

        pendingInteraction:
          runtimeState.pendingInteraction
            ? "present"
            : "none",

        pendingHumanControl:
          runtimeState.pendingHumanControl
            ? "present"
            : "none",
      },
    );

    if (
      runtimeState.status ===
      "completed"
    ) {
      return createCompletedResult(
        nextState,
      );
    }

    if (
      runtimeState.status ===
      "waiting"
    ) {
      return createWaitingResult(
        nextState,
      );
    }

    if (
      runtimeState.status ===
      "failed"
    ) {
      return createFailedResult(
        nextState,
      );
    }

    throw new Error(
      `Unexpected runtime status after human control resume: ${runtimeState.status}`,
    );
  }

  private async continueConversation(
    agent: Agent,
    context: RunContext,
    history: RuntimeHistory,
    runtimeState: RuntimeState,
  ): Promise<ConversationResult> {
    for (
      let turn = 0;
      turn <
      this.maxTurns;
      turn += 1
    ) {
      console.log(
        "[AGENT] generating response...",
      );

      await this.events?.emit({
        type:
          "llm.started",

        context,
      });

      const response =
        await this.llm.generate({
          agent,

          messages:
            history.getMessages(),

          tools:
            this.tools.list(
              agent.tools,
            ),
        });

      await this.events?.emit({
        type:
          "llm.completed",

        context,
      });

      console.log(
        "[AGENT] LLM response:",
        response,
      );

      if (
        response.type ===
        "text"
      ) {
        history.addAssistantMessage(
          response.content,
        );

        runtimeState.status =
          "completed";

        runtimeState.result =
          response.content;

        runtimeState.messages =
          history.getMessages();

        await this.events?.emit({
          type:
            "agent.completed",

          context,

          output:
            response.content,
        });

        return {
          status:
            "completed",

          runId:
            context.runId,

          content:
            response.content,

          state: {
            agent,

            context,

            history:
              history.getMessages(),

            runtimeState,
          },
        };
      }

      history.addAssistantToolCalls(
        response.calls,
      );

      const interactionCalls =
        response.calls.filter(
          isUserInteractionToolCall,
        );

      if (
        interactionCalls.length >
        1
      ) {
        throw new Error(
          "The model requested multiple user interactions in the same turn.",
        );
      }

      if (
        interactionCalls.length ===
        1
      ) {
        if (
          response.calls.length !==
          1
        ) {
          throw new Error(
            "A user interaction must be the only tool call in an LLM response.",
          );
        }

        const call =
          interactionCalls[0];

        const interaction =
          parseUserInteraction(
            call,
          );

        runtimeState.status =
          "waiting";

        runtimeState.pendingInteraction =
          {
            toolCallId:
              call.id,

            interaction,
          };

        runtimeState.messages =
          history.getMessages();

        await this.events?.emit({
          type:
            "user_interaction.required",

          context,

          interaction,
        });

        return {
          status:
            "waiting",

          runId:
            context.runId,

          pendingInteraction:
            runtimeState.pendingInteraction,

          state: {
            agent,

            context,

            history:
              history.getMessages(),

            runtimeState,
          },
        };
      }

      for (const call of response.calls) {
        console.log(
          "[AGENT] tool requested:",
          {
            toolId:
              call.toolId,

            arguments:
              call.arguments,
          },
        );

        const execution:
          RuntimeToolExecution =
          await this.runtime.executeTool(
            context,
            call,
          );

        if (
          execution.status ===
          "approval_required"
        ) {
          runtimeState.status =
            "waiting";

          runtimeState.pendingApprovalId =
            execution.approvalId;

          runtimeState.pendingToolCall =
            call;

          runtimeState.messages =
            history.getMessages();

          return {
            status:
              "waiting",

            runId:
              context.runId,

            pendingApprovalId:
              execution.approvalId,

            pendingToolCall:
              call,

            state: {
              agent,

              context,

              history:
                history.getMessages(),

              runtimeState,
            },
          };
        }

        if (
          execution.status ===
          "human_control_requested"
        ) {
          if (
            response.calls.length !==
            1
          ) {
            throw new Error(
              "A human control request must be the only tool call in an LLM response.",
            );
          }

          if (
            !execution.result
          ) {
            throw new Error(
              "Human control request returned no result.",
            );
          }

          const output =
            execution.result.output;

          if (
            !isHumanControlRequestOutput(
              output,
            )
          ) {
            throw new Error(
              "Invalid human control request result.",
            );
          }

          history.addToolResult(
            call.id,
            call.toolId,
            output,
          );

          runtimeState.status =
            "waiting";

          runtimeState.pendingHumanControl =
            {
              toolCallId:
                call.id,

              reason:
                output.reason,

              message:
                output.message,
            };

          runtimeState.pendingApprovalId =
            undefined;

          runtimeState.pendingToolCall =
            undefined;

          runtimeState.messages =
            history.getMessages();

          await this.events?.emit({
            type:
              "computer.human_control.required",

            context,

            toolCallId:
              call.id,

            reason:
              output.reason,

            message:
              output.message,
          });

          return {
            status:
              "waiting",

            runId:
              context.runId,

            pendingHumanControl:
              runtimeState.pendingHumanControl,

            state: {
              agent,

              context,

              history:
                history.getMessages(),

              runtimeState,
            },
          };
        }

        if (
          execution.status ===
          "denied"
        ) {
          history.addToolResult(
            call.id,
            call.toolId,
            {
              error:
                execution.reason ??
                "Tool execution denied by Gateway.",
            },
          );

          continue;
        }

        if (
          !execution.result
        ) {
          history.addToolResult(
            call.id,
            call.toolId,
            {
              error:
                "Tool execution returned no result.",
            },
          );

          continue;
        }

        const toolResult =
          execution.result;

        const content =
          toolResult.status ===
          "success"
            ? toolResult.output
            : {
                error:
                  toolResult.error,
              };

        history.addToolResult(
          call.id,
          call.toolId,
          content,
        );
      }

      runtimeState.messages =
        history.getMessages();
    }

    const error =
      `Maximum conversation turns exceeded: ${this.maxTurns}`;

    runtimeState.status =
      "failed";

    runtimeState.error =
      error;

    runtimeState.messages =
      history.getMessages();

    await this.events?.emit({
      type:
        "agent.failed",

      context,

      error,
    });

    return {
      status:
        "failed",

      runId:
        context.runId,

      error,

      state: {
        agent,

        context,

        history:
          history.getMessages(),

        runtimeState,
      },
    };
  }
}