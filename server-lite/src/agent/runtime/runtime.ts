import type {
  ApprovalDecision,
  ApprovalStore,
} from "../approvals/approvals";
import type { AgentEventSink } from "../events/events";
import type { LLMProvider } from "../llm/provider";
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
   * Démarre un nouveau run à partir
   * de l'identifiant d'un agent.
   *
   * L'agent est chargé depuis l'AgentStore,
   * puis transmis au RuntimeLoop.
   */
  async run(
    agentId: string,
    message: string,
  ): Promise<RuntimeState> {
    const agent =
      await this.dependencies.agents.get(
        agentId,
      );

    if (!agent) {
      throw new Error(
        `Agent not found: ${agentId}`,
      );
    }

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

      maxTurns:
        this.maxTurns,

      toolResults: [],
    };

    return this.loop.run(
      state,
    );
  }

  /**
   * Reprend un run après une demande
   * d'approbation.
   */
  async resume(
    state: RuntimeState,
    decision: ApprovalDecision,
  ): Promise<RuntimeState> {
    if (
      state.status !== "waiting"
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

    await this.dependencies.approvals.decide(
      approvalId,
      decision,
    );

    // --------------------------------------------------
    // Rejet
    // --------------------------------------------------

    if (
      decision === "rejected"
    ) {
      state.status =
        "failed";

      state.error =
        "Tool execution rejected";

      state.pendingApprovalId =
        undefined;

      state.pendingToolCall =
        undefined;

      await this.dependencies.events?.emit({
        type: "agent.failed",
        runId: state.runId,
        error: state.error,
      });

      return state;
    }

    // --------------------------------------------------
    // Vérification de la décision
    // --------------------------------------------------

    const storedDecision =
      await this.dependencies.approvals.getDecision(
        approvalId,
      );

    if (
      storedDecision !== "approved"
    ) {
      throw new Error(
        "Approval was not approved",
      );
    }

    state.pendingApprovalId =
      undefined;

    state.status =
      "running";

    return this.loop.run(
      state,
    );
  }

  /**
   * Annule un run.
   */
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

    state.status =
      "cancelled";

    state.pendingApprovalId =
      undefined;

    state.pendingToolCall =
      undefined;

    return state;
  }
}