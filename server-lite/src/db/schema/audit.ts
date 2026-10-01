import {
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

// ============================================================
// Audit Events
// ============================================================

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),

    type: text("type").notNull(),

    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    payload: text("payload")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_audit_created")
      .on(table.createdAt),

    index("audit_actor_idx")
      .on(table.actorId),
  ],
);

// ============================================================
// Action Policy
// ============================================================

export const actionPolicy = pgTable(
  "action_policy",
  {
    id: text("id").primaryKey(),

    mode: text("mode", {
      enum: [
        "enforce",
        "dry-run",
      ],
    }).notNull(),

    deny: text("deny").notNull(),

    allow: text("allow").notNull(),
  },
);