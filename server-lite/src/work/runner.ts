import type {
  LLMMessage,
} from "../agent/llm/provider";

import type {
  AgentRuntime,
} from "../agent/runtime/runtime";

import type {
  AuditStore,
} from "../gateway/audit";

import type {
  WorkQueue,
} from "./queue";

import {
  AgentConversation,
  type ConversationResult,
  type ConversationState,
} from "../agent/conversation";

import type {
  LLMProvider,
} from "../agent/llm/provider";

import type {
  ToolRegistry,
} from "../agent/tools/tools";

import type {
  Agent,
} from "../agent/agent";

import type {
  AgentEventSink,
  RunContext,
} from "../agent/events/events";

import type {
  ConversationStore,
} from "../agent/conversation-store";

import type {
  ApprovalStore,
} from "../agent/approvals/approvals";

import {
  InteractionStore,
} from "../agent/interactions/postgres-store";

export type TurnRunner =
  ReturnType<typeof createTurnRunner>;

export function createTurnRunner(deps: {
  queue: WorkQueue;

  approvals: ApprovalStore;

  interactions: InteractionStore;

  channels: {
    getOwned(
      channelId: string,
      userId: string,
    ): Promise<{
      id: string;
      active: boolean;
    } | null>;

    history(
      channelId: string,
      limit?: number,
    ): Promise<
      Array<{
        role:
          | "user"
          | "assistant"
          | "system";

        content: string;

        interactionId: string | null;

        approvalId: string | null;
      }>
    >;

    appendMessage(input: {
      channelId: string;

      role:
        | "user"
        | "assistant"
        | "system";

      content: string;

      agentId?: string;

      interactionId?: string | null;

      approvalId?: string | null;
    }): Promise<{
      id: string;

      createdAt: Date;
    }>;
  };

  audit: AuditStore;

  llm: LLMProvider;

  tools: ToolRegistry;

  getAgent(
    agentId: string,
  ): Promise<Agent | null>;

  createRuntime: (
    actorId: string,
  ) => AgentRuntime;

  conversationStore: ConversationStore;

  events?: AgentEventSink;

  pollMs?: number;
}) {
  const pollMs =
    deps.pollMs ?? 500;

  console.log(
    "[TURN RUNNER] Created",
    {
      events:
        deps.events
          ? "defined"
          : "undefined",

      pollMs,
    },
  );

  let stopped = false;

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  function getChannelId(
    state: ConversationState,
  ): string {
    const channelId =
      state.context.channelId;

    if (!channelId) {
      throw new Error(
        "Conversation context is missing channelId.",
      );
    }

    return channelId;
  }

  function getAgentId(
    state: ConversationState,
  ): string {
    return state.context.agentId;
  }

  async function saveCompletedResponse(
    result: ConversationResult,
    state: ConversationState,
    options?: {
      approvalId?: string | null;
      interactionId?: string | null;
    },
  ) {
    const reply =
  "C'est fait. La tâche est terminée.";

    if (!reply) {
      throw new Error(
        `Agent "${getAgentId(
          state,
        )}" completed without a response.`,
      );
    }

    const channelId =
      getChannelId(state);

    const agentId =
      getAgentId(state);

    const message =
      await deps.channels.appendMessage({
        channelId,

        role: "assistant",

        content: reply,

        agentId,

        approvalId:
          options?.approvalId ??
          null,

        interactionId:
          options?.interactionId ??
          null,
      });

    console.log(
      "[TURN RUNNER] Assistant message saved",
      {
        id: message.id,

        channelId,

        agentId,

        runId:
          result.runId,

        approvalId:
          options?.approvalId ??
          null,

        interactionId:
          options?.interactionId ??
          null,
      },
    );

    await deps.events?.emit({
      type:
        "message.created",

      context:
        state.context,

      message: {
        id:
          message.id,

        channelId,

        role:
          "assistant",

        content:
          reply,

        agentId,

        createdAt:
          message.createdAt.toISOString(),
      },
    });

    await deps.audit.record(
      "channel.agent_replied",
      state.context.actorId,
      {
        channelId,

        agentId,

        runId:
          result.runId,
      },
    );

    deps.conversationStore.delete(
      result.runId,
    );

    return message;
  }

  async function persistWaitingState(
    result: ConversationResult,
  ) {
    if (!result.state) {
      throw new Error(
        `Conversation "${result.runId}" is waiting but returned no state.`,
      );
    }

    const state =
      result.state;

    const channelId =
      getChannelId(state);

    const agentId =
      getAgentId(state);

    // ------------------------------------------------
    // User interaction
    // ------------------------------------------------

    if (
      result.pendingInteraction
    ) {
      const interactionId =
        crypto.randomUUID();

      await deps.interactions.create({
        id: interactionId,

        runId:
          result.runId,

        toolCallId:
          result.pendingInteraction
            .toolCallId,

        interaction:
          result.pendingInteraction
            .interaction,
      });

      await deps.channels.appendMessage({
        channelId,

        role: "assistant",

        content:
          result.pendingInteraction
            .interaction.question,

        agentId,

        interactionId,
      });

      console.log(
        "[TURN RUNNER] Interaction persisted",
        {
          interactionId,

          runId:
            result.runId,

          channelId,
        },
      );
    }

    // ------------------------------------------------
    // Approval
    // ------------------------------------------------

    if (
      result.pendingApprovalId
    ) {
      await deps.channels.appendMessage({
        channelId,

        role: "assistant",

        content:
          "Approval required.",

        agentId,

        approvalId:
          result.pendingApprovalId,
      });

      console.log(
        "[TURN RUNNER] Approval message saved",
        {
          approvalId:
            result.pendingApprovalId,

          runId:
            result.runId,

          channelId,
        },
      );
    }

    // ------------------------------------------------
    // Human control
    // ------------------------------------------------

    if (
      result.pendingHumanControl
    ) {
      console.log(
        "[TURN RUNNER] Human control required",
        {
          runId:
            result.runId,

          channelId,

          agentId,

          toolCallId:
            result.pendingHumanControl
              .toolCallId,

          reason:
            result.pendingHumanControl
              .reason,

          message:
            result.pendingHumanControl
              .message,
        },
      );
    }

    // ------------------------------------------------
    // Store runtime state
    // ------------------------------------------------

    deps.conversationStore.set(
      result.runId,
      state,
    );

    console.log(
      "[TURN RUNNER] Conversation state stored",
      {
        runId:
          result.runId,

        channelId,

        agentId,

        pendingApprovalId:
          result.pendingApprovalId ??
          null,

        pendingInteraction:
          result.pendingInteraction
            ? "present"
            : "none",

        pendingHumanControl:
          result.pendingHumanControl
            ? "present"
            : "none",
      },
    );

    await deps.audit.record(
      "channel.agent_waiting",
      state.context.actorId,
      {
        channelId,

        agentId,

        runId:
          result.runId,

        pendingApprovalId:
          result.pendingApprovalId ??
          null,

        pendingInteraction:
          Boolean(
            result.pendingInteraction,
          ),

        pendingHumanControl:
          Boolean(
            result.pendingHumanControl,
          ),
      },
    );
  }

  async function handleConversationResult(
    result: ConversationResult,
    options?: {
      approvalId?: string | null;
      interactionId?: string | null;
    },
  ) {
    // ------------------------------------------------
    // Failed
    // ------------------------------------------------

    if (
      result.status === "failed"
    ) {
      console.log(
        "[TURN RUNNER] Conversation failed",
        {
          runId:
            result.runId,

          error:
            result.error,
        },
      );

      throw new Error(
        result.error ??
          "Agent conversation failed.",
      );
    }

    // ------------------------------------------------
    // Waiting
    // ------------------------------------------------

    if (
      result.status === "waiting"
    ) {
      console.log(
        "[TURN RUNNER] Conversation waiting",
        {
          runId:
            result.runId,

          pendingApprovalId:
            result.pendingApprovalId ??
            null,

          pendingInteraction:
            result.pendingInteraction
              ? "present"
              : "none",

          pendingHumanControl:
            result.pendingHumanControl
              ? "present"
              : "none",
        },
      );

      await persistWaitingState(
        result,
      );

      return result;
    }

    // ------------------------------------------------
    // Completed
    // ------------------------------------------------

    if (
      result.status !==
      "completed"
    ) {
      throw new Error(
        `Agent conversation ended with status "${result.status}".`,
      );
    }

    if (!result.state) {
      throw new Error(
        `Conversation "${result.runId}" completed without state.`,
      );
    }

    await saveCompletedResponse(
      result,
      result.state,
      options,
    );

    return result;
  }

  // --------------------------------------------------
  // Main channel turn
  // --------------------------------------------------

  async function handleChannelTurn(
    payload: Record<string, unknown>,
  ) {
    console.log(
      "[TURN RUNNER] Handling channel turn",
      {
        payload,
      },
    );

    const channelId =
      String(
        payload.channelId ??
          "",
      );

    const agentId =
      String(
        payload.agentId ??
          "",
      );

    const actorId =
      String(
        payload.actorId ??
          "",
      );

    console.log(
      "[TURN RUNNER] Parsed payload",
      {
        channelId,

        agentId,

        actorId,
      },
    );

    if (!channelId) {
      throw new Error(
        "Channel turn is missing channelId.",
      );
    }

    if (!agentId) {
      throw new Error(
        "Channel turn is missing agentId.",
      );
    }

    if (!actorId) {
      throw new Error(
        "Channel turn is missing actorId.",
      );
    }

    // --------------------------------------------------
    // Channel
    // --------------------------------------------------

    const channel =
      await deps.channels.getOwned(
        channelId,
        actorId,
      );

    if (!channel) {
      throw new Error(
        `Channel "${channelId}" not found.`,
      );
    }

    if (!channel.active) {
      throw new Error(
        `Channel "${channelId}" is inactive.`,
      );
    }

    // --------------------------------------------------
    // History
    // --------------------------------------------------

    const history =
      await deps.channels.history(
        channelId,
        40,
      );

    console.log(
      "[TURN RUNNER] History loaded",
      {
        channelId,

        count:
          history.length,
      },
    );

    if (
      history.length === 0
    ) {
      throw new Error(
        `Channel "${channelId}" has no messages.`,
      );
    }

    const messages:
      LLMMessage[] = [];

    for (
      const message of history
    ) {
      if (
        message.role ===
          "user" ||
        message.role ===
          "assistant"
      ) {
        messages.push({
          role:
            message.role,

          content:
            message.content,
        });
      }
    }

    if (
      messages.length === 0
    ) {
      throw new Error(
        `Channel "${channelId}" has no usable messages.`,
      );
    }

    // --------------------------------------------------
    // Agent
    // --------------------------------------------------

    const agent =
      await deps.getAgent(
        agentId,
      );

    if (!agent) {
      throw new Error(
        `Agent "${agentId}" not found.`,
      );
    }

    // --------------------------------------------------
    // Runtime
    // --------------------------------------------------

    const runtime =
      deps.createRuntime(
        actorId,
      );

    const conversation =
      new AgentConversation(
        deps.llm,

        deps.tools,

        runtime,

        deps.events,
      );

    const runContext:
      RunContext = {
        runId:
          crypto.randomUUID(),

        channelId,

        agentId,

        actorId,
      };

    console.log(
      "[TURN RUNNER] Starting conversation",
      {
        runId:
          runContext.runId,

        channelId,

        agentId,
      },
    );

    const result =
      await conversation.run(
        agent,

        messages,

        runContext,
      );

    console.log(
      "[TURN RUNNER] Conversation result",
      {
        status:
          result.status,

        runId:
          result.runId,

        content:
          result.content ??
          null,

        error:
          result.error ??
          null,

        pendingApprovalId:
          result.pendingApprovalId ??
          null,

        pendingInteraction:
          result.pendingInteraction
            ? "present"
            : "none",

        pendingHumanControl:
          result.pendingHumanControl
            ? "present"
            : "none",
      },
    );

    await handleConversationResult(
      result,
    );
  }

  // --------------------------------------------------
  // Resume approval
  // --------------------------------------------------

  async function resumeApproval(
    approvalId: string,
    decision:
      | "approved"
      | "rejected",
  ) {
    console.log(
      "[TURN RUNNER] Resuming approval",
      {
        approvalId,

        decision,
      },
    );

    const approval =
      await deps.approvals.get(
        approvalId,
      );

    if (!approval) {
      throw new Error(
        `Approval "${approvalId}" not found.`,
      );
    }

    if (
      approval.status !==
      "pending"
    ) {
      throw new Error(
        `Approval "${approvalId}" is already decided: ${approval.status}`,
      );
    }

    const conversationState =
      deps.conversationStore.get(
        approval.runId,
      );

    if (!conversationState) {
      throw new Error(
        `Conversation state not found for run "${approval.runId}".`,
      );
    }

    if (
      conversationState.runtimeState
        .pendingApprovalId !==
      approvalId
    ) {
      throw new Error(
        "Approval does not match the pending conversation state.",
      );
    }

    const runtime =
      deps.createRuntime(
        conversationState.context
          .actorId,
      );

    const conversation =
      new AgentConversation(
        deps.llm,

        deps.tools,

        runtime,

        deps.events,
      );

    const result =
      await conversation.resume(
        conversationState,

        decision,
      );

    console.log(
      "[TURN RUNNER] Resumed approval result",
      {
        status:
          result.status,

        runId:
          result.runId,

        error:
          result.error ??
          null,
      },
    );

    if (
      result.status ===
      "failed"
    ) {
      deps.conversationStore.delete(
        result.runId,
      );

      await deps.audit.record(
        "channel.turn_failed",
        conversationState.context
          .actorId,
        {
          channelId:
            conversationState.context
              .channelId,

          agentId:
            conversationState.context
              .agentId,

          runId:
            result.runId,

          approvalId,

          error:
            result.error ??
            "Conversation failed after approval decision.",
        },
      );

      if (
        decision ===
        "rejected"
      ) {
        return result;
      }

      throw new Error(
        result.error ??
          "Conversation failed after approval decision.",
      );
    }

    if (
      result.status ===
      "waiting"
    ) {
      await persistWaitingState(
        result,
      );

      return result;
    }

    if (
      result.status !==
      "completed"
    ) {
      throw new Error(
        `Unexpected conversation status: ${result.status}`,
      );
    }

    await saveCompletedResponse(
      result,

      result.state,

      {
        approvalId,
      },
    );

    return result;
  }

  // --------------------------------------------------
  // Resume user interaction
  // --------------------------------------------------

  async function resumeUserInteraction(
    runId: string,
    answer: string,
  ) {
    console.log(
      "[TURN RUNNER] Resuming user interaction",
      {
        runId,

        answer,
      },
    );

    const conversationState =
      deps.conversationStore.get(
        runId,
      );

    if (!conversationState) {
      throw new Error(
        `Conversation state not found for run "${runId}".`,
      );
    }

    const pendingInteraction =
      conversationState.runtimeState
        .pendingInteraction;

    if (!pendingInteraction) {
      throw new Error(
        `Conversation "${runId}" has no pending user interaction.`,
      );
    }

    const interaction =
      await deps.interactions
        .getPendingByRunId(
          runId,
        );

    if (!interaction) {
      throw new Error(
        `Pending user interaction not found in database for run "${runId}".`,
      );
    }

    const runtime =
      deps.createRuntime(
        conversationState.context
          .actorId,
      );

    const conversation =
      new AgentConversation(
        deps.llm,

        deps.tools,

        runtime,

        deps.events,
      );

    const result =
      await conversation.resumeUserInteraction(
        conversationState,

        answer,
      );

    console.log(
      "[TURN RUNNER] Resumed user interaction result",
      {
        status:
          result.status,

        runId:
          result.runId,

        error:
          result.error ??
          null,
      },
    );

    if (
      result.status ===
      "failed"
    ) {
      deps.conversationStore.delete(
        result.runId,
      );

      await deps.audit.record(
        "channel.turn_failed",
        conversationState.context
          .actorId,
        {
          channelId:
            conversationState.context
              .channelId,

          agentId:
            conversationState.context
              .agentId,

          runId:
            result.runId,

          error:
            result.error ??
            "Conversation failed after user interaction.",
        },
      );

      throw new Error(
        result.error ??
          "Conversation failed after user interaction.",
      );
    }

    await deps.interactions.answer(
      interaction.id,

      answer,
    );

    if (
      result.status ===
      "waiting"
    ) {
      await persistWaitingState(
        result,
      );

      return result;
    }

    if (
      result.status !==
      "completed"
    ) {
      throw new Error(
        `Unexpected conversation status: ${result.status}`,
      );
    }

    await saveCompletedResponse(
      result,

      result.state,

      {
        interactionId:
          interaction.id,
      },
    );

    return result;
  }

  // --------------------------------------------------
  // Resume human computer control
  // --------------------------------------------------

  async function resumeHumanControl(
    runId: string,
  ) {
    console.log(
      "[TURN RUNNER] Resuming human control",
      {
        runId,
      },
    );

    const conversationState =
      deps.conversationStore.get(
        runId,
      );

    if (!conversationState) {
      throw new Error(
        `Conversation state not found for run "${runId}".`,
      );
    }

    const pendingHumanControl =
      conversationState.runtimeState
        .pendingHumanControl;

    if (
      !pendingHumanControl
    ) {
      throw new Error(
        `Conversation "${runId}" has no pending human control request.`,
      );
    }

    if (
      conversationState.runtimeState
        .status !==
      "waiting"
    ) {
      throw new Error(
        `Conversation "${runId}" is not waiting for human control.`,
      );
    }

    console.log(
      "[TURN RUNNER] Human control request found",
      {
        runId,

        channelId:
          conversationState.context
            .channelId,

        agentId:
          conversationState.context
            .agentId,

        toolCallId:
          pendingHumanControl
            .toolCallId,

        reason:
          pendingHumanControl
            .reason,
      },
    );

    const runtime =
      deps.createRuntime(
        conversationState.context
          .actorId,
      );

    const conversation =
      new AgentConversation(
        deps.llm,

        deps.tools,

        runtime,

        deps.events,
      );

    const result =
      await conversation.resumeHumanControl(
        conversationState,
      );

    console.log(
      "[TURN RUNNER] Human control resumed",
      {
        status:
          result.status,

        runId:
          result.runId,

        error:
          result.error ??
          null,

        pendingApprovalId:
          result.pendingApprovalId ??
          null,

        pendingInteraction:
          result.pendingInteraction
            ? "present"
            : "none",

        pendingHumanControl:
          result.pendingHumanControl
            ? "present"
            : "none",
      },
    );

    if (
      result.status ===
      "failed"
    ) {
      deps.conversationStore.delete(
        result.runId,
      );

      await deps.audit.record(
        "channel.turn_failed",
        conversationState.context
          .actorId,
        {
          channelId:
            conversationState.context
              .channelId,

          agentId:
            conversationState.context
              .agentId,

          runId:
            result.runId,

          error:
            result.error ??
            "Conversation failed after human control.",
        },
      );

      throw new Error(
        result.error ??
          "Conversation failed after human control.",
      );
    }

    if (
      result.status ===
      "waiting"
    ) {
      await persistWaitingState(
        result,
      );

      return result;
    }

    if (
      result.status !==
      "completed"
    ) {
      throw new Error(
        `Unexpected conversation status after human control: ${result.status}`,
      );
    }

    await saveCompletedResponse(
      result,

      result.state,
    );

    console.log(
      "[TURN RUNNER] Human control flow completed",
      {
        runId:
          result.runId,

        channelId:
          conversationState.context
            .channelId,

        agentId:
          conversationState.context
            .agentId,
      },
    );

    return result;
  }

  // --------------------------------------------------
  // Queue loop
  // --------------------------------------------------

  async function loop() {
    console.log(
      "[TURN RUNNER] Loop started",
      {
        pollMs,
      },
    );

    while (!stopped) {
      const item =
        await deps.queue.claim(
          "channel.turn",
        );

      if (item) {
        console.log(
          "[TURN RUNNER] Work item claimed",
          {
            id:
              item.id,
          },
        );

        try {
          await handleChannelTurn(
            item.payload,
          );

          console.log(
            "[TURN RUNNER] Completing work item",
            {
              id:
                item.id,
            },
          );

          await deps.queue.complete(
            item.id,
          );

          console.log(
            "[TURN RUNNER] Work item completed",
            {
              id:
                item.id,
            },
          );
        } catch (error) {
          console.error(
            "[TURN RUNNER] Work item failed",
            {
              id:
                item.id,

              error,
            },
          );

          await deps.audit.record(
            "channel.turn_failed",
            null,
            {
              error:
                error instanceof Error
                  ? error.message
                  : String(error),

              workId:
                item.id,
            },
            "system",
          );

          await deps.queue.fail(
            item.id,
          );

          console.log(
            "[TURN RUNNER] Work item marked failed",
            {
              id:
                item.id,
            },
          );
        }
      }

      await Bun.sleep(
        pollMs,
      );
    }

    console.log(
      "[TURN RUNNER] Loop stopped",
    );
  }

  return {
    start() {
      console.log(
        "[TURN RUNNER] start() called",
      );

      void loop();
    },

    stop() {
      console.log(
        "[TURN RUNNER] stop() called",
      );

      stopped = true;
    },

    resumeApproval,

    resumeUserInteraction,

    resumeHumanControl,
  };
}

