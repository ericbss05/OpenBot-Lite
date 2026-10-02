import { eq } from "drizzle-orm";

import type { Db } from "../../db";
import { approvals } from "../../db/schema";

import type {
  ApprovalDecision,
  ApprovalRecord,
  ApprovalRequest,
  ApprovalStore,
} from "./approvals";

export function createPostgresApprovalStore(
  db: Db,
): ApprovalStore {
  return {
    async create(
      request: ApprovalRequest,
    ): Promise<void> {
      await db
        .insert(approvals)
        .values({
          id: request.id,
          runId: request.runId,
          toolCallId: request.toolCallId,
          toolId: request.toolId,
          arguments: request.arguments,
          actorId: request.actorId,
          status: "pending",
        });
    },

    async get(
      approvalId: string,
    ): Promise<ApprovalRecord | null> {
      const [row] = await db
        .select()
        .from(approvals)
        .where(
          eq(
            approvals.id,
            approvalId,
          ),
        )
        .limit(1);

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        runId: row.runId,
        toolCallId: row.toolCallId,
        toolId: row.toolId,
        arguments: row.arguments,
        actorId: row.actorId,
        status: row.status,
        createdAt: row.createdAt,
        decidedAt:
          row.decidedAt ??
          undefined,
      };
    },

    async decide(
      approvalId: string,
      decision: ApprovalDecision,
    ): Promise<void> {
      await db
        .update(approvals)
        .set({
          status: decision,
          decidedAt: new Date(),
        })
        .where(
          eq(
            approvals.id,
            approvalId,
          ),
        );
    },

    async getDecision(
      approvalId: string,
    ): Promise<ApprovalDecision | null> {
      const approval =
        await this.get(
          approvalId,
        );

      if (!approval) {
        return null;
      }

      if (
        approval.status ===
          "approved" ||
        approval.status ===
          "rejected"
      ) {
        return approval.status;
      }

      return null;
    },
  };
}