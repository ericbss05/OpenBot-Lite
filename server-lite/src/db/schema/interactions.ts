import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const interactions = pgTable(
  "interactions",
  {
    id: text("id").primaryKey(),

    runId: text("run_id")
      .notNull(),

    toolCallId: text("tool_call_id")
      .notNull(),

    type: text("type", {
      enum: [
        "clarification",
        "ask_user",
      ],
    }).notNull(),

    question: text("question")
      .notNull(),

    options: jsonb("options")
      .$type<
        Array<{
          label: string;
          value: string;
        }>
      >(),

    status: text("status", {
      enum: [
        "pending",
        "answered",
        "cancelled",
      ],
    })
      .notNull()
      .default("pending"),

    answer: text("answer"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    answeredAt: timestamp("answered_at"),
  },
  (table) => [
    index("interactions_run_idx").on(
      table.runId,
    ),

    index("interactions_status_idx").on(
      table.status,
    ),
  ],
);