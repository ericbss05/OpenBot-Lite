import type { Tool } from "../tools/tools";

export interface ApprovalRequest {
  id: string;
  runId: string;
  toolCallId: string;
  toolId: string;
  arguments: Record<string, unknown>;
}

export type ApprovalDecision = "approved" | "rejected";

export interface ApprovalStore {
  create(request: ApprovalRequest): Promise<void>;
  decide(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<void>;
  getDecision(
    approvalId: string,
  ): Promise<ApprovalDecision | null>;
}

export function requiresApproval(tool: Tool): boolean {
  return tool.definition.requiresApproval === true;
}
