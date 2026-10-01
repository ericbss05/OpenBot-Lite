import type { AgentEventSink } from "../events/events";
import type { LLMProvider } from "../llm/provider";
import {
  requiresApproval,
  type ApprovalStore,
} from "../approvals/approvals";
import {
  ToolExecutor,
  ToolRegistry,
  type ToolCall,
} from "../tools/tools";
import { RuntimeHistory } from "./history";
import type { RuntimeState } from "./state";

export interface RuntimeDependencies {
  llm: LLMProvider;
  tools: ToolRegistry;
  approvals?: ApprovalStore;
  events?: AgentEventSink;
}

export class RuntimeLoop {
  private readonly executor: ToolExecutor;

  constructor(
    private readonly dependencies: RuntimeDependencies,
  ) {
    this.executor = new ToolExecutor(
      dependencies.tools,
    );
  }

  async run(
    state: RuntimeState,
  ): Promise<RuntimeState> {
    state.status = "running";

    const history = new RuntimeHistory(
      state.messages,
    );

    try {
      // --------------------------------------------------
      // Reprise d'un tool après approbation
      // --------------------------------------------------

      if (state.pendingToolCall) {
        const pendingCall = state.pendingToolCall;

        state.pendingToolCall = undefined;

        await this.executeTool(
          state,
          history,
          pendingCall,
        );
      }

      // --------------------------------------------------
      // Boucle principale
      // --------------------------------------------------

      while (state.turn < state.maxTurns) {
        state.turn += 1;

        await this.dependencies.events?.emit({
          type: "llm.started",
          runId: state.runId,
        });

        const response =
          await this.dependencies.llm.generate({
            agent: state.agent,

            messages: history.getMessages(),

            tools: this.dependencies.tools.list(
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

        if (response.type === "text") {
          history.addAssistantMessage(
            response.content,
          );

          state.status = "completed";
          state.result = response.content;

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

        history.addAssistantToolCalls(
          response.calls,
        );

        for (const call of response.calls) {
          const tool =
            this.dependencies.tools.get(
              call.toolId,
            );

          // ----------------------------------------------
          // Tool introuvable
          // ----------------------------------------------

          if (!tool) {
            history.addToolResult(
              call.id,
              {
                error: `Tool not found: ${call.toolId}`,
              },
            );

            continue;
          }

          // ----------------------------------------------
          // Approval nécessaire
          // ----------------------------------------------

          if (
            requiresApproval(tool) &&
            this.dependencies.approvals
          ) {
            const approvalId =
              crypto.randomUUID();

            await this.dependencies.approvals.create({
              id: approvalId,
              runId: state.runId,
              toolCallId: call.id,
              toolId: call.toolId,
              arguments: call.arguments,
            });

            // On conserve exactement le tool call
            // qui doit être repris après approval.
            state.pendingApprovalId =
              approvalId;

            state.pendingToolCall = call;

            state.status = "waiting";

            await this.dependencies.events?.emit({
              type: "approval.required",
              runId: state.runId,
              approvalId,
              toolCallId: call.id,
            });

            return state;
          }

          // ----------------------------------------------
          // Exécution directe
          // ----------------------------------------------

          await this.executeTool(
            state,
            history,
            call,
          );
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

  private async executeTool(
    state: RuntimeState,
    history: RuntimeHistory,
    call: ToolCall,
  ): Promise<void> {
    await this.dependencies.events?.emit({
      type: "tool.started",
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
    });

    const result =
      await this.executor.execute(call);

    state.toolResults.push(result);

    const content =
      result.status === "success"
        ? result.output
        : {
            error: result.error,
          };

    history.addToolResult(
      call.id,
      content,
    );

    await this.dependencies.events?.emit({
      type: "tool.completed",
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
      status: result.status,
    });
  }
}