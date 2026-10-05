import type {
  ApprovalDecision,
  ApprovalStore,
} from "../approvals/approvals";

import type {
  AgentEventSink,
  RunContext,
} from "../events/events";

import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
} from "../llm/provider";

import {
  validateUserInteractionAnswer,
} from "../interactions/user-interaction";

import { ToolRegistry } from "../tools/tools";

import type {
  GatewayExecutor,
} from "../../gateway/executor";

import type {
  AgentStore,
} from "../store";

import {
  RuntimeHistory,
} from "./history";

import { RuntimeLoop } from "./loop";

import type {
  RuntimeState,
} from "./state";

export interface AgentRuntimeDependencies {
  llm: LLMProvider;

  tools: ToolRegistry;

  gateway: GatewayExecutor;

  agents: AgentStore;

  approvals?: ApprovalStore;

  events?: AgentEventSink;

  /**
   * Kept for compatibility with the current runtime
   * construction and tests.
   *
   * The actual actor for a run comes from
   * RunContext.actorId.
   */
  actorId?: string;
}

export interface RuntimeToolExecution {
  status:
    | "executed"
    | "approval_required"
    | "denied";

  toolCall: LLMToolCall;

  approvalId?: string;

  result?: {
    toolCallId: string;
    toolId: string;
    status: "success" | "error";
    output?: unknown;
    error?: string;
  };

  reason?: string;
}

export class AgentRuntime {
  private readonly loop: RuntimeLoop;

  constructor(
    private readonly dependencies: AgentRuntimeDependencies,
    private readonly maxTurns = 10,
  ) {
    this.loop =
      new RuntimeLoop(
        dependencies,
      );
  }

  /**
   * Execute a single tool for an existing run context.
   *
   * AgentConversation uses this method when the LLM
   * decides that a tool is required.
   */
  async executeTool(
    context: RunContext,
    toolCall: LLMToolCall,
    approvalGranted = false,
  ): Promise<RuntimeToolExecution> {
    const agent =
      await this.dependencies.agents.get(
        context.agentId,
      );

    if (!agent) {
      throw new Error(
        `Agent not found: ${context.agentId}`,
      );
    }

    const state: RuntimeState = {
      runId:
        context.runId,

      context,

      agent,

      status:
        "running",

      messages: [],

      turn: 0,

      maxTurns: 1,

      toolResults: [],
    };

    return this.loop.executeTool(
      state,
      toolCall,
      approvalGranted,
    );
  }

  /**
   * Run the complete runtime loop.
   *
   * This is useful for runtime-driven workflows
   * where the runtime itself owns the LLM loop.
   *
   * AgentConversation remains the preferred path
   * for normal channel conversations.
   */
  async run(
    context: RunContext,
    messages: LLMMessage[],
  ): Promise<RuntimeState> {
    const agent =
      await this.dependencies.agents.get(
        context.agentId,
      );

    if (!agent) {
      throw new Error(
        `Agent not found: ${context.agentId}`,
      );
    }

    if (
      messages.length ===
      0
    ) {
      throw new Error(
        "Cannot run agent without messages.",
      );
    }

    const state: RuntimeState = {
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

    await this.dependencies.events?.emit({
      type:
        "run.started",

      context,
    });

    return this.loop.run(
      state,
    );
  }

  /**
   * Resume a runtime after an approval decision.
   */
  async resume(
    state: RuntimeState,
    decision: ApprovalDecision,
  ): Promise<RuntimeState> {
    if (
      state.status !==
      "waiting"
    ) {
      throw new Error(
        `Cannot resume runtime from status: ${state.status}`,
      );
    }

    if (
      !state.pendingApprovalId
    ) {
      throw new Error(
        "No pending approval",
      );
    }

    if (
      !state.pendingToolCall
    ) {
      throw new Error(
        "No pending tool call",
      );
    }

    if (
      !this.dependencies.approvals
    ) {
      throw new Error(
        "ApprovalStore is not configured.",
      );
    }

    const approvalId =
      state.pendingApprovalId;

    const approval =
      await this.dependencies.approvals.get(
        approvalId,
      );

    if (!approval) {
      throw new Error(
        `Approval not found: ${approvalId}`,
      );
    }

    if (
      approval.runId !==
      state.context.runId
    ) {
      throw new Error(
        "Approval does not belong to this run.",
      );
    }

    if (
      approval.toolCallId !==
      state.pendingToolCall.id
    ) {
      throw new Error(
        "Approval does not belong to the pending tool call.",
      );
    }

    if (
      approval.toolId !==
      state.pendingToolCall.toolId
    ) {
      throw new Error(
        "Approval does not belong to the pending tool.",
      );
    }

    if (
      approval.actorId !==
      state.context.actorId
    ) {
      throw new Error(
        "Approval does not belong to this actor.",
      );
    }

    if (
      approval.status !==
      "pending"
    ) {
      throw new Error(
        `Approval is already decided: ${approval.status}`,
      );
    }

    await this.dependencies.approvals.decide(
      approvalId,
      decision,
    );

    await this.dependencies.events?.emit({
      type:
        decision === "approved"
          ? "approval.approved"
          : "approval.rejected",

      context:
        state.context,

      approvalId,

      toolCallId:
        approval.toolCallId,

      toolId:
        approval.toolId,
    });

    if (
      decision ===
      "rejected"
    ) {
      state.pendingApprovalId =
        undefined;

      state.status =
        "running";

      return state;
    }

    const toolCall =
      state.pendingToolCall;

    const execution =
      await this.loop.executeTool(
        state,
        toolCall,
        true,
      );

    if (
      execution.status ===
      "approval_required"
    ) {
      throw new Error(
        "Approved tool unexpectedly requires another approval.",
      );
    }

    if (
      execution.status ===
      "denied"
    ) {
      state.status =
        "failed";

      state.error =
        execution.reason ??
        "Tool execution denied by Gateway.";

      state.pendingApprovalId =
        undefined;

      state.pendingToolCall =
        undefined;

      await this.dependencies.events?.emit({
        type:
          "agent.failed",

        context:
          state.context,

        error:
          state.error,
      });

      return state;
    }

    state.pendingApprovalId =
      undefined;

    state.pendingToolCall =
      undefined;

    state.status =
      "running";

    return state;
  }

  /**
   * Apply a user interaction answer
   * without running the LLM again.
   *
   * AgentConversation uses this method
   * because AgentConversation owns its
   * own LLM loop.
   */
  applyUserInteractionAnswer(
    state: RuntimeState,
    answer: string,
  ): RuntimeState {
    if (
      state.status !==
      "waiting"
    ) {
      throw new Error(
        `Cannot answer user interaction from status: ${state.status}`,
      );
    }

    if (
      !state.pendingInteraction
    ) {
      throw new Error(
        "No pending user interaction.",
      );
    }

    const pendingInteraction =
      state.pendingInteraction;

    const validatedAnswer =
      validateUserInteractionAnswer(
        pendingInteraction.interaction,
        answer,
      );

    const history =
      new RuntimeHistory(
        state.messages,
      );

    /*
     * The LLM requested user_interaction
     * as a tool call. The user's answer
     * therefore becomes the tool result
     * for that call.
     */
    history.addToolResult(
      pendingInteraction.toolCallId,
      "user_interaction",
      {
        type:
          pendingInteraction
            .interaction.type,

        answer:
          validatedAnswer,
      },
    );

    state.messages =
      history.getMessages();

    state.pendingInteraction =
      undefined;

    state.status =
      "running";

    return state;
  }

  /**
   * Resume a runtime-owned user interaction.
   *
   * This method applies the user's answer
   * and then continues the RuntimeLoop.
   */
  async resumeUserInteraction(
    state: RuntimeState,
    answer: string,
  ): Promise<RuntimeState> {
    this.applyUserInteractionAnswer(
      state,
      answer,
    );

    return this.loop.run(
      state,
    );
  }

  /**
   * Cancel a runtime that has not already finished.
   */
  cancel(
    state: RuntimeState,
  ): RuntimeState {
    if (
      state.status ===
        "completed" ||
      state.status ===
        "failed" ||
      state.status ===
        "cancelled"
    ) {
      return state;
    }

    state.status =
      "cancelled";

    state.pendingApprovalId =
      undefined;

    state.pendingToolCall =
      undefined;

    state.pendingInteraction =
      undefined;

    return state;
  }
}