import type { AgentEventSink } from "../events/events";
import type { LLMProvider } from "../llm/provider";
import type {
  ApprovalStore,
} from "../approvals/approvals";
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

  /**
   * Gateway obligatoire pour toutes les exécutions
   * de tools.
   */
  gateway: GatewayExecutor;

  approvals?: ApprovalStore;
  events?: AgentEventSink;

  /**
   * Identité de l'utilisateur qui déclenche le run.
   */
  actorId?: string;
}

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
      // --------------------------------------------------
      // Reprise après approval
      // --------------------------------------------------

      if (state.pendingToolCall) {
        const pendingCall =
          state.pendingToolCall;

        /*
         * Le ToolCall a déjà été approuvé par le Runtime.
         *
         * On transmet donc approvalGranted=true au Gateway.
         *
         * IMPORTANT :
         * cela ne désactive PAS la policy du Gateway.
         * Cela indique uniquement que le contrôle
         * d'approbation utilisateur a déjà été effectué.
         */
        const execution =
          await this.executeThroughGateway(
            state,
            history,
            pendingCall,
            true,
          );

        if (
          execution === "waiting"
        ) {
          return state;
        }

        if (
          execution === "denied"
        ) {
          state.pendingToolCall =
            undefined;

          state.pendingApprovalId =
            undefined;

          state.status = "failed";

          state.error =
            "Tool execution denied by Gateway.";

          await this.dependencies.events?.emit({
            type: "agent.failed",
            runId: state.runId,
            error: state.error,
          });

          return state;
        }

        /*
         * Le ToolCall approuvé a maintenant été exécuté.
         */
        state.pendingToolCall =
          undefined;

        state.pendingApprovalId =
          undefined;
      }

      // --------------------------------------------------
      // Boucle principale
      // --------------------------------------------------

      while (
        state.turn < state.maxTurns
      ) {
        state.turn += 1;

        await this.dependencies.events?.emit({
          type: "llm.started",
          runId: state.runId,
        });

        const response =
          await this.dependencies.llm.generate({
            agent: state.agent,

            messages:
              history.getMessages(),

            tools:
              this.dependencies.tools.list(
                state.agent.tools,
              ),
          });

        await this.dependencies.events?.emit({
          type: "llm.completed",
          runId: state.runId,
        });

        // ------------------------------------------------
        // Réponse finale
        // ------------------------------------------------

        if (
          response.type === "text"
        ) {
          history.addAssistantMessage(
            response.content,
          );

          state.status = "completed";

          state.result =
            response.content;

          await this.dependencies.events?.emit({
            type: "agent.completed",
            runId: state.runId,
            output: response.content,
          });

          return state;
        }

        // ------------------------------------------------
        // Tool calls
        // ------------------------------------------------

        /*
         * IMPORTANT :
         * Les tool calls de l'assistant sont ajoutés
         * à l'historique AVANT leur exécution.
         */
        history.addAssistantToolCalls(
          response.calls,
        );

        for (
          const call of response.calls
        ) {
          const execution =
            await this.executeThroughGateway(
              state,
              history,
              call,
              false,
            );

          // ----------------------------------------------
          // Approval demandée
          // ----------------------------------------------

          if (
            execution === "waiting"
          ) {
            return state;
          }

          // ----------------------------------------------
          // Tool refusé
          // ----------------------------------------------

          if (
            execution === "denied"
          ) {
            history.addToolResult(
              call.id,
              {
                error:
                  "Tool execution denied by Gateway.",
              },
            );

            continue;
          }
        }
      }

      // --------------------------------------------------
      // Max turns
      // --------------------------------------------------

      state.status = "failed";

      state.error =
        `Maximum turns exceeded: ${state.maxTurns}`;

      await this.dependencies.events?.emit({
        type: "agent.failed",
        runId: state.runId,
        error: state.error,
      });

      return state;
    } catch (error) {
      state.status = "failed";

      state.error =
        error instanceof Error
          ? error.message
          : "Unknown runtime error";

      await this.dependencies.events?.emit({
        type: "agent.failed",
        runId: state.runId,
        error: state.error,
      });

      return state;
    }
  }

  private async executeThroughGateway(
    state: RuntimeState,
    history: RuntimeHistory,
    call: ToolCall,
    approvalGranted = false,
  ): Promise<
    "executed" | "waiting" | "denied"
  > {
    await this.dependencies.events?.emit({
      type: "tool.started",
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
    });

    const result =
      await this.dependencies.gateway.execute({
        context: {
          runId: state.runId,

          actorId:
            this.dependencies.actorId ??
            "system",

          botId: state.agent.id,
        },

        toolCall: call,

        /*
         * false :
         * première exécution, le Gateway peut demander
         * une approbation.
         *
         * true :
         * reprise d'un ToolCall déjà approuvé.
         */
        approvalGranted,
      });

    // --------------------------------------------------
    // Approval
    // --------------------------------------------------

    if (
      result.status ===
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
        runId: state.runId,
        toolCallId: call.id,
        toolId: call.toolId,
        arguments: call.arguments,
      });

      state.pendingApprovalId =
        approvalId;

      state.pendingToolCall =
        call;

      state.status = "waiting";

      await this.dependencies.events?.emit({
        type: "approval.required",
        runId: state.runId,
        approvalId,
        toolCallId: call.id,
      });

      return "waiting";
    }

    // --------------------------------------------------
    // Denied
    // --------------------------------------------------

    if (
      result.status === "denied"
    ) {
      await this.dependencies.events?.emit({
        type: "tool.completed",
        runId: state.runId,
        toolCallId: call.id,
        toolId: call.toolId,
        status: "error",
      });

      return "denied";
    }

    // --------------------------------------------------
    // Executed
    // --------------------------------------------------

    if (!result.result) {
      throw new Error(
        `Gateway returned executed status without a result for tool "${call.toolId}".`,
      );
    }

    const toolResult =
      result.result;

    state.toolResults.push(
      toolResult,
    );

    const content =
      toolResult.status === "success"
        ? toolResult.output
        : {
            error:
              toolResult.error,
          };

    /*
     * Le résultat du tool est ajouté après
     * l'exécution effective.
     */
    history.addToolResult(
      call.id,
      content,
    );

    await this.dependencies.events?.emit({
      type: "tool.completed",
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
      status: toolResult.status,
    });

    return "executed";
  }
}