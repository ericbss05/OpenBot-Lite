import { Hono } from "hono";

import type {
  ApprovalStore,
} from "../agent/approvals/approvals";
import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";

export function createApprovalRoutes(deps: {
approvals: ApprovalStore;
audit: AuditStore;

resumeApproval: (
approvalId: string,
decision: "approved" | "rejected",
) => Promise<unknown>;
}) {
const app = new Hono<{ Variables: AppVariables }>();

app.post("/:id/approve", async (c) => {
const user = requireUser(c);
const id = c.req.param("id");

const approval =
  await deps.approvals.get(id);

if (!approval) {
  return c.json(
    { error: "Approval not found" },
    404,
  );
}

if (approval.actorId !== user.id) {
  return c.json(
    { error: "Forbidden" },
    403,
  );
}

if (approval.status !== "pending") {
  return c.json(
    {
      error:
        `Approval already decided: ${approval.status}`,
    },
    409,
  );
}

try {
  await deps.resumeApproval(
    id,
    "approved",
  );

  return c.json({
    success: true,
    approvalId: id,
    status: "approved",
  });
} catch (error) {
  console.error(
    "[APPROVAL] Failed to resume approved conversation",
    error,
  );

  return c.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume conversation",
    },
    500,
  );
}

});

app.post("/:id/reject", async (c) => {
const user = requireUser(c);
const id = c.req.param("id");

const approval =
  await deps.approvals.get(id);

if (!approval) {
  return c.json(
    { error: "Approval not found" },
    404,
  );
}

if (approval.actorId !== user.id) {
  return c.json(
    { error: "Forbidden" },
    403,
  );
}

if (approval.status !== "pending") {
  return c.json(
    {
      error:
        `Approval already decided: ${approval.status}`,
    },
    409,
  );
}

try {
  await deps.resumeApproval(
    id,
    "rejected",
  );

  return c.json({
    success: true,
    approvalId: id,
    status: "rejected",
  });
} catch (error) {
  console.error(
    "[APPROVAL] Failed to resume rejected conversation",
    error,
  );

  return c.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume conversation",
    },
    500,
  );
}

});

return app;
}

