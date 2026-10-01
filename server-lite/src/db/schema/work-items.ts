import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================
// Work Items
// ============================================================

export const workItems = pgTable(
  "work_items",
  {
    id: text("id").primaryKey(),

    kind: text("kind").notNull(),

    key: text("key").notNull(),

    payload: text("payload").notNull(),

    status: text("status", {
      enum: [
        "pending",
        "claimed",
        "done",
        "failed",
      ],
    }).notNull(),

    leaseUntil:
      timestamp("lease_until"),

    attempts: integer("attempts")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("work_items_kind_key")
      .on(
        table.kind,
        table.key,
      ),

    index("idx_work_items_queue")
      .on(
        table.status,
        table.leaseUntil,
      ),
  ],
);