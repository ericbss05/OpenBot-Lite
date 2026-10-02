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

  /**
   * Ancien flux conservé temporairement pour AgentRuntime.resume().
   * Le nouveau flux passe par executeTool().
   */
  async run(
    state: RuntimeState,
  ): Promise<RuntimeState> {
    state.status = "running";

    const history = new RuntimeHistory(
      state.messages,
    );

    try {
      if (state.pendingToolCall) {
        const execution =
          await this.executeTool(
            state,
            state.pendingToolCall,
            true,
          );

        if (execution.status === "approval_required") {
  return state;
        }

        if (execution.status === "denied") {
          return this.fail(
            state,
            "Tool execution denied by Gateway.",
          );
        }

        state.pendingToolCall = undefined;
        state.pendingApprovalId = undefined;
      }

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

        history.addAssistantToolCalls(
          response.calls,
        );

        for (const call of response.calls) {
          const execution =
            await this.executeTool(
              state,
              call,
            );

          if (execution.status === "approval_required") {
  return state;
}

          if (execution.status === "denied") {
            history.addToolResult(call.id, {
              error:
                execution.reason ??
                "Tool execution denied by Gateway.",
            });
            continue;
          }

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

  /**
   * Nouveau point d'entrée du Runtime.
   *
   * Le LLM décide de l'action.
   * Le Runtime ne fait qu'exécuter cette action
   * via le Gateway.
   */
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
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
    });

    console.log("[RUNTIME] executing tool:", {
      runId: state.runId,
      toolId: call.toolId,
      arguments: call.arguments,
      approvalGranted,
    });

    const gatewayResult =
      await this.dependencies.gateway.execute({
        context: {
          runId: state.runId,
          actorId:
            this.dependencies.actorId ??
            "system",
          botId: state.agent.id,
        },
        toolCall: call,
        approvalGranted,
      });

    console.log(
      "[RUNTIME] gateway result:",
      gatewayResult,
    );

    if (
      gatewayResult.status ===
      "approval_required"
    ) {
      if (!this.dependencies.approvals) {
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
        actorId:
          this.dependencies.actorId ?? "",
      });

      state.pendingApprovalId = approvalId;
      state.pendingToolCall = call;
      state.status = "waiting";

      await this.dependencies.events?.emit({
        type: "approval.required",
        runId: state.runId,
        approvalId,
        toolCallId: call.id,
      });

      return {
        status: "approval_required",
        toolCall: call,
        approvalId,
        reason: gatewayResult.reason,
      };
    }

    if (gatewayResult.status === "denied") {
      await this.dependencies.events?.emit({
        type: "tool.completed",
        runId: state.runId,
        toolCallId: call.id,
        toolId: call.toolId,
        status: "error",
      });

      return {
        status: "denied",
        toolCall: call,
        reason: gatewayResult.reason,
      };
    }

    if (!gatewayResult.result) {
      throw new Error(
        `Gateway returned executed status without a result for tool "${call.toolId}".`,
      );
    }

    const result = gatewayResult.result;

    state.toolResults.push(result);

    await this.dependencies.events?.emit({
      type: "tool.completed",
      runId: state.runId,
      toolCallId: call.id,
      toolId: call.toolId,
      status: result.status,
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
      runId: state.runId,
      error,
    });

    return state;
  }
}
