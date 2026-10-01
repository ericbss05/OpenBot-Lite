import type { AuditStore } from "./audit";
import type { Gateway } from "./store";
import type {
  GatewayExecutionRequest,
  GatewayExecutionResponse,
} from "./types";

import {
  ToolExecutor,
  ToolRegistry,
} from "../agent/tools/tools";

import { requiresApproval } from "../agent/approvals/approvals";

export class GatewayExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly gateway: Gateway,
    private readonly audit: AuditStore,
  ) {}

  async execute(
    request: GatewayExecutionRequest,
  ): Promise<GatewayExecutionResponse> {
    const {
      context,
      toolCall,
      approvalGranted = false,
    } = request;

    const tool =
      this.registry.get(
        toolCall.toolId,
      );

    if (!tool) {
      const reason =
        `Tool not found: ${toolCall.toolId}`;

      await this.audit.record(
        "tool.denied",
        context.actorId,
        {
          runId: context.runId,
          botId: context.botId,
          toolId: toolCall.toolId,
          toolCallId: toolCall.id,
          reason,
        },
      );

      return {
        status: "denied",
        toolCall,
        reason,
      };
    }

    const decision =
      this.gateway.evaluate({
        tool: {
          name: tool.definition.id,
        },

        bot: {
          id: context.botId,
        },

        page: context.page,

        actor: {
          id: context.actorId,
        },
      });

    if (!decision.allowed) {
      await this.audit.record(
        "tool.denied",
        context.actorId,
        {
          runId: context.runId,
          botId: context.botId,
          toolId: toolCall.toolId,
          toolCallId: toolCall.id,
          arguments: toolCall.arguments,
          reason: decision.reason,
        },
      );

      return {
        status: "denied",
        toolCall,
        reason: decision.reason,
      };
    }

    /*
     * Une approbation est demandée uniquement lors
     * du premier passage du ToolCall.
     *
     * Lors d'un resume(), le Runtime transmet
     * approvalGranted=true pour ce même ToolCall.
     */
    if (
      requiresApproval(tool) &&
      !approvalGranted
    ) {
      await this.audit.record(
        "tool.approval_required",
        context.actorId,
        {
          runId: context.runId,
          botId: context.botId,
          toolId: toolCall.toolId,
          toolCallId: toolCall.id,
          arguments: toolCall.arguments,
        },
      );

      return {
        status: "approval_required",
        toolCall,
        reason:
          "Tool requires approval before execution.",
      };
    }

    if (decision.dryRun) {
      await this.audit.record(
        "tool.dry_run",
        context.actorId,
        {
          runId: context.runId,
          botId: context.botId,
          toolId: toolCall.toolId,
          toolCallId: toolCall.id,
          arguments: toolCall.arguments,
        },
      );

      return {
        status: "executed",
        toolCall,

        result: {
          toolCallId: toolCall.id,
          toolId: toolCall.toolId,
          status: "success",

          output: {
            dryRun: true,
            message:
              "Tool execution skipped because Gateway is in dry-run mode.",
          },
        },
      };
    }

    await this.audit.record(
      "tool.execution_started",
      context.actorId,
      {
        runId: context.runId,
        botId: context.botId,
        toolId: toolCall.toolId,
        toolCallId: toolCall.id,
        approvalGranted,
      },
    );

    const result =
      await this.executor.execute(
        toolCall,
      );

    await this.audit.record(
      result.status === "success"
        ? "tool.execution_completed"
        : "tool.execution_failed",
      context.actorId,
      {
        runId: context.runId,
        botId: context.botId,
        toolId: toolCall.toolId,
        toolCallId: toolCall.id,
        result,
      },
    );

    return {
      status: "executed",
      toolCall,
      result,
    };
  }
}