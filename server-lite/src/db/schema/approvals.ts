import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { agentProfiles } from "./agents";

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),

    runId: text("run_id")
      .notNull(),

    toolCallId: text("tool_call_id")
      .notNull(),

    toolId: text("tool_id")
      .notNull(),

    arguments: jsonb("arguments")
      .$type<Record<string, unknown>>()
      .notNull(),

    actorId: text("actor_id")
      .notNull(),

    status: text("status", {
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
    })
      .notNull()
      .default("pending"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    decidedAt: timestamp("decided_at"),
  },
  (table) => [
    uniqueIndex(
      "approvals_tool_call_idx",
    ).on(table.toolCallId),

    index(
      "approvals_run_idx",
    ).on(table.runId),

    index(
      "approvals_actor_idx",
    ).on(table.actorId),

    index(
      "approvals_status_idx",
    ).on(table.status),
  ],
);