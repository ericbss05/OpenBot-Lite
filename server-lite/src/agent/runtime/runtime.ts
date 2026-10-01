import type { Agent } from "../agent";
import type {
  ApprovalDecision,
  ApprovalStore,
} from "../approvals/approvals";
import type { AgentEventSink } from "../events/events";
import type { LLMProvider } from "../llm/provider";
import { ToolRegistry } from "../tools/tools";
import { RuntimeLoop } from "./loop";
import type { RuntimeState } from "./state";

export interface AgentRuntimeDependencies {
  llm: LLMProvider;
  tools: ToolRegistry;
  approvals?: ApprovalStore;
  events?: AgentEventSink;
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
   * Démarre un nouveau run.
   */
  async run(
    agent: Agent,
    message: string,
  ): Promise<RuntimeState> {
    const state: RuntimeState = {
      runId: crypto.randomUUID(),
      agent,
      status: "pending",

      messages: [
        {
          role: "user",
          content: message,
        },
      ],

      turn: 0,
      maxTurns: this.maxTurns,

      toolResults: [],
    };

    return this.loop.run(state);
  }

  /**
   * Reprend un run interrompu par une demande d'approbation.
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

    if (
      !state.pendingApprovalId ||
      !this.dependencies.approvals
    ) {
      throw new Error("No pending approval");
    }

    if (!state.pendingToolCall) {
      throw new Error("No pending tool call");
    }

    const approvalId = state.pendingApprovalId;

    await this.dependencies.approvals.decide(
      approvalId,
      decision,
    );

    if (decision === "rejected") {
      state.status = "failed";
      state.error = "Tool execution rejected";
      state.pendingApprovalId = undefined;
      state.pendingToolCall = undefined;

      await this.dependencies.events?.emit({
        type: "agent.failed",
        runId: state.runId,
        error: state.error,
      });

      return state;
    }

    const storedDecision =
      await this.dependencies.approvals.getDecision(
        approvalId,
      );

    if (storedDecision !== "approved") {
      throw new Error("Approval was not approved");
    }

    /**
     * L'approbation est validée.
     *
     * Le tool call reste disponible dans state.pendingToolCall
     * jusqu'à ce que le RuntimeLoop le reprenne.
     */
    state.pendingApprovalId = undefined;
    state.status = "running";

    return this.loop.run(state);
  }

  /**
   * Annule un run.
   */
  cancel(state: RuntimeState): RuntimeState {
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