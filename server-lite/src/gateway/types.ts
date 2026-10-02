import type {
  ToolCall,
  ToolResult,
  ToolRegistry,
  ToolExecutor,
} from "../agent/tools/tools";

import type { Gateway } from "./store";
import type { AuditStore } from "./audit";
import type { ToolAuthorizationService } from "../agent/authorization";

export interface GatewayExecutionContext {
  runId: string;
  actorId: string;
  botId: string;

  page?: {
    url: string;
    host: string;
  };
}

export interface GatewayExecutionRequest {
  context: GatewayExecutionContext;
  toolCall: ToolCall;

  /**
   * True lorsque ce ToolCall a déjà reçu
   * une approbation explicite.
   */
  approvalGranted?: boolean;
}

export type GatewayExecutionStatus =
  | "executed"
  | "denied"
  | "approval_required";

export interface GatewayExecutionResponse {
  status: GatewayExecutionStatus;
  toolCall: ToolCall;
  result?: ToolResult;
  reason?: string;
}

export interface GatewayExecutorDependencies {
  registry: ToolRegistry;
  executor: ToolExecutor;
  gateway: Gateway;
  audit: AuditStore;
  authorization: ToolAuthorizationService;
}