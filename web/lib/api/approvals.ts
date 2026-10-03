import { apiRequest } from "@/lib/api/client";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

export type Approval = {
  id: string;
  runId: string;
  toolCallId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  actorId: string;
  status: ApprovalStatus;
};

export type ApprovalDecisionResponse = {
  success: boolean;
  approvalId: string;
  status: "approved" | "rejected";
};

export async function approveApproval(
  approvalId: string,
): Promise<ApprovalDecisionResponse> {
  return apiRequest<ApprovalDecisionResponse>(
    `/api/approvals/${approvalId}/approve`,
    {
      method: "POST",
    },
  );
}

export async function rejectApproval(
  approvalId: string,
): Promise<ApprovalDecisionResponse> {
  return apiRequest<ApprovalDecisionResponse>(
    `/api/approvals/${approvalId}/reject`,
    {
      method: "POST",
    },
  );
}