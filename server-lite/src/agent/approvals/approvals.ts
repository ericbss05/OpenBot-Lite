import type { Tool } from "../tools/tools";

export interface ApprovalRequest {
  id: string;
  runId: string;
  toolCallId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  actorId: string;
}

export interface ApprovalRecord
  extends ApprovalRequest {
  status: ApprovalStatus;
  createdAt: Date;
  decidedAt?: Date;
}

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

export type ApprovalDecision =
  | "approved"
  | "rejected";

export interface ApprovalStore {
  create(
    request: ApprovalRequest,
  ): Promise<void>;

  get(
    approvalId: string,
  ): Promise<ApprovalRecord | null>;

  decide(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<void>;

  getDecision(
    approvalId: string,
  ): Promise<ApprovalDecision | null>;
}

export function requiresApproval(
  tool: Tool,
): boolean {
  return (
    tool.definition.requiresApproval === true
  );
}