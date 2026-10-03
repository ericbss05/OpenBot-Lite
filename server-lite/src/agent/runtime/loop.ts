import type { AgentEventSink } from "../events/events";
import type { LLMProvider } from "../llm/provider";
import type { ApprovalStore } from "../approvals/approvals";
import {
  ToolRegistry,
  type ToolCall,
} from "../tools/tools";
import type { GatewayExecutor } from "../../gateway/executor";
import { RuntimeHistory } from "./history";
import type { RuntimeState } from "./state";

export interface RuntimeDependencies {
  llm: LLMProvider;
  tools: ToolRegistry;
  gateway: GatewayExecutor;
  approvals?: ApprovalStore;
  events?: AgentEventSink;
  actorId?: string;
}

type ExecutionStatus =
  | "executed"
  | "approval_required"
  | "denied";

export class RuntimeLoop {
  constructor(
    private readonly dependencies: RuntimeDependencies,
  ) {}

  async run(
    state: RuntimeState,
  ): Promise<RuntimeState> {
    state.status = "running";

    const history = new RuntimeHistory(
      state.messages,
    );

    try {
      /*
       * If the runtime is resumed after an approval,
       * execute the pending tool first.
       */
      if (state.pendingToolCall) {
        const execution =
          await this.executeTool(
            state,
            state.pendingToolCall,
            true,
          );

        if (
          execution.status ===
          "approval_required"
        ) {
          return state;
        }

        if (
          execution.status ===
          "denied"
        ) {
          return this.fail(
            state,
            "Tool execution denied by Gateway.",
          );
        }

        state.pendingToolCall =
          undefined;

        state.pendingApprovalId =
          undefined;

        if (execution.result) {
          const output =
            execution.result.status ===
            "success"
              ? execution.result.output
              : {
                  error:
                    execution.result.error,
                };

          history.addToolResult(
            execution.toolCall.id,
            output,
          );
        }
      }

      while (
        state.turn <
        state.maxTurns
      ) {
        state.turn += 1;

        await this.dependencies.events?.emit({
          type: "llm.started",
          context: state.context,
        });

        const response =
          await this.dependencies.llm.generate({
            agent: state.agent,
            messages:
              history.getMessages(),
            tools: this.dependencies.tools.list(
              state.agent.tools,
            ),
          });

        await this.dependencies.events?.emit({
          type: "llm.completed",
          context: state.context,
        });

        /*
         * The model answered directly.
         */
        if (response.type === "text") {
          history.addAssistantMessage(
            response.content,
          );

          state.status = "completed";
          state.result =
            response.content;

          await this.dependencies.events?.emit({
            type: "agent.completed",
            context: state.context,
            output:
              response.content,
          });

          return state;
        }

        /*
         * The model requested one or more tools.
         */
        history.addAssistantToolCalls(
          response.calls,
        );

        for (const call of response.calls) {
          const execution =
            await this.executeTool(
              state,
              call,
            );

          /*
           * The run is paused until the user
           * approves the pending tool call.
           */
          if (
            execution.status ===
            "approval_required"
          ) {
            return state;
          }

          /*
           * The Gateway explicitly denied
           * the tool call. Feed the error
           * back to the model so it can react.
           */
          if (
            execution.status ===
            "denied"
          ) {
            history.addToolResult(
              call.id,
              {
                error:
                  execution.reason ??
                  "Tool execution denied by Gateway.",
              },
            );

            continue;
          }

          /*
           * Normal successful or failed
           * tool execution.
           */
          if (execution.result) {
            const output =
              execution.result.status ===
              "success"
                ? execution.result.output
                : {
                    error:
                      execution.result.error,
                  };

            history.addToolResult(
              call.id,
              output,
            );
          }
        }
      }

      return this.fail(
        state,
        `Maximum turns exceeded: ${state.maxTurns}`,
      );
    } catch (error) {
      return this.fail(
        state,
        error instanceof Error
          ? error.message
          : "Unknown runtime error",
      );
    }
  }

  async executeTool(
    state: RuntimeState,
    call: ToolCall,
    approvalGranted = false,
  ): Promise<{
    status: ExecutionStatus;
    toolCall: ToolCall;
    approvalId?: string;
    result?: {
      toolCallId: string;
      toolId: string;
      status: "success" | "error";
      output?: unknown;
      error?: string;
    };
    reason?: string;
  }> {
    await this.dependencies.events?.emit({
      type: "tool.started",
      context: state.context,
      toolCallId: call.id,
      toolId: call.toolId,
      arguments: call.arguments,
    });

    console.log(
      "[RUNTIME] executing tool:",
      {
        runId:
          state.context.runId,
        toolId: call.toolId,
        arguments: call.arguments,
        approvalGranted,
      },
    );

    const gatewayResult =
      await this.dependencies.gateway.execute({
        context: {
          runId:
            state.context.runId,
          actorId:
            state.context.actorId,
          botId: state.agent.id,
        },
        toolCall: call,
        approvalGranted,
      });

    console.log(
      "[RUNTIME] gateway result:",
      gatewayResult,
    );

    /*
     * The Gateway requires user approval.
     */
    if (
      gatewayResult.status ===
      "approval_required"
    ) {
      if (
        !this.dependencies.approvals
      ) {
        throw new Error(
          `Tool "${call.toolId}" requires approval but no ApprovalStore is configured.`,
        );
      }

      const approvalId =
        crypto.randomUUID();

      await this.dependencies.approvals.create({
        id: approvalId,
        runId:
          state.context.runId,
        toolCallId: call.id,
        toolId: call.toolId,
        arguments: call.arguments,
        actorId:
          state.context.actorId,
      });

      state.pendingApprovalId =
        approvalId;

      state.pendingToolCall =
        call;

      state.status = "waiting";

      await this.dependencies.events?.emit({
        type: "approval.required",
        context: state.context,
        approvalId,
        toolCallId: call.id,
        toolId: call.toolId,
        arguments: call.arguments,
      });

      return {
        status: "approval_required",
        toolCall: call,
        approvalId,
        reason:
          gatewayResult.reason,
      };
    }

    /*
     * The Gateway denied the action.
     */
    if (
      gatewayResult.status ===
      "denied"
    ) {
      await this.dependencies.events?.emit({
        type: "tool.completed",
        context: state.context,
        toolCallId: call.id,
        toolId: call.toolId,
        status: "error",
        error:
          gatewayResult.reason,
      });

      return {
        status: "denied",
        toolCall: call,
        reason:
          gatewayResult.reason,
      };
    }

    /*
     * The Gateway says the tool executed,
     * so a result must be present.
     */
    if (!gatewayResult.result) {
      throw new Error(
        `Gateway returned executed status without a result for tool "${call.toolId}".`,
      );
    }

    const result =
      gatewayResult.result;

    state.toolResults.push(
      result,
    );

    await this.dependencies.events?.emit({
      type: "tool.completed",
      context: state.context,
      toolCallId: call.id,
      toolId: call.toolId,
      status: result.status,
      result: result.output,
      ...(result.error
        ? {
            error:
              result.error,
          }
        : {}),
    });

    return {
      status: "executed",
      toolCall: call,
      result,
    };
  }

  private async fail(
    state: RuntimeState,
    error: string,
  ): Promise<RuntimeState> {
    state.status = "failed";
    state.error = error;

    await this.dependencies.events?.emit({
      type: "agent.failed",
      context: state.context,
      error,
    });

    return state;
  }
}