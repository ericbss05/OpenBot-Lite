import type {
  ApprovalDecision,
  ApprovalStore,
} from "../approvals/approvals";
import type { AgentEventSink } from "../events/events";
import type {
  LLMMessage,
  LLMProvider,
  LLMToolCall,
} from "../llm/provider";
import { ToolRegistry } from "../tools/tools";
import type { GatewayExecutor } from "../../gateway/executor";
import type { AgentStore } from "../store";
import { RuntimeLoop } from "./loop";
import type { RuntimeState } from "./state";

export interface AgentRuntimeDependencies {
  llm: LLMProvider;
  tools: ToolRegistry;
  gateway: GatewayExecutor;
  agents: AgentStore;
  approvals?: ApprovalStore;
  events?: AgentEventSink;
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
    this.loop = new RuntimeLoop(dependencies);
  }

  /**
   * Nouveau point d'entrée du Runtime.
   *
   * Le Runtime reçoit uniquement une action décidée
   * par le LLM.
   *
   * Il ne décide pas quand appeler le LLM.
   */
  async executeTool(
  runId: string,
  agentId: string,
  toolCall: LLMToolCall,
  approvalGranted = false,
): Promise<RuntimeToolExecution> {
  const agent = await this.dependencies.agents.get(agentId);

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  return this.loop.executeTool(
    {
      runId,
      agent,
      status: "running",
      messages: [],
      turn: 0,
      maxTurns: 1,
      toolResults: [],
    },
    toolCall,
    approvalGranted,
  );
}

  /**
   * Ancienne API conservée temporairement.
   *
   * Elle sera supprimée lorsque TurnRunner
   * utilisera directement le nouveau flux :
   *
   * LLM → tool_call → executeTool()
   */
  async run(
    agentId: string,
    messages: LLMMessage[],
  ): Promise<RuntimeState> {
    const agent =
      await this.dependencies.agents.get(agentId);

    if (!agent) {
      throw new Error(
        `Agent not found: ${agentId}`,
      );
    }

    if (messages.length === 0) {
      throw new Error(
        "Cannot run agent without messages.",
      );
    }

    const state: RuntimeState = {
      runId: crypto.randomUUID(),
      agent,
      status: "pending",
      messages: [...messages],
      turn: 0,
      maxTurns: this.maxTurns,
      toolResults: [],
    };

    return this.loop.run(state);
  }

  /**
   * Ancienne API de reprise conservée temporairement.
   *
   * Elle sera adaptée lorsque l'état du Runtime
   * sera entièrement séparé de l'état de conversation.
   */
  async resume(
    state: RuntimeState,
    decision: ApprovalDecision,
  ): Promise<RuntimeState> {
    if (state.status !== "waiting") {
      throw new Error(
        `Cannot resume runtime from status: ${state.status}`,
      );
    }

    if (!state.pendingApprovalId) {
      throw new Error("No pending approval");
    }

    if (!state.pendingToolCall) {
      throw new Error("No pending tool call");
    }

    if (!this.dependencies.approvals) {
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

    if (approval.runId !== state.runId) {
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
      this.dependencies.actorId &&
      approval.actorId !==
        this.dependencies.actorId
    ) {
      throw new Error(
        "Approval does not belong to this actor.",
      );
    }

    if (approval.status !== "pending") {
      throw new Error(
        `Approval is already decided: ${approval.status}`,
      );
    }

    await this.dependencies.approvals.decide(
      approvalId,
      decision,
    );

    if (decision === "rejected") {
      state.status = "failed";
      state.error =
        "Tool execution rejected";
      state.pendingApprovalId = undefined;
      state.pendingToolCall = undefined;

      await this.dependencies.events?.emit({
        type: "agent.failed",
        runId: state.runId,
        error: state.error,
      });

      return state;
    }

    state.pendingApprovalId = undefined;
    state.status = "running";

    return this.loop.run(state);
  }

  cancel(
    state: RuntimeState,
  ): RuntimeState {
    if (
      state.status === "completed" ||
      state.status === "failed" ||
      state.status === "cancelled"
    ) {
      return state;
    }

    state.status = "cancelled";
    state.pendingApprovalId = undefined;
    state.pendingToolCall = undefined;

    return state;
  }
}