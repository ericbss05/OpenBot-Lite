import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agentProfiles } from "./agents";

// ============================================================
// Channels
// ============================================================

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    threadId: text("thread_id")
      .notNull(),

    /**
     * JSON array of agent IDs.
     */
    agentIds: text("agent_ids")
      .notNull(),

    active: boolean("active")
      .notNull(),

    lastMessageAt:
      timestamp("last_message_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    userId: text("user_id")
      .references(() => user.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    index("channels_user_idx")
      .on(table.userId),

    index("channels_thread_idx")
      .on(table.threadId),
  ],
);

// ============================================================
// Channel Messages
// ============================================================

export const channelMessages = pgTable(
  "channel_messages",
  {
    id: text("id").primaryKey(),

    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
      }),

    role: text("role", {
      enum: [
        "user",
        "assistant",
        "system",
      ],
    }).notNull(),

    agentId: text("agent_id")
      .references(() => agentProfiles.id, {
        onDelete: "set null",
      }),

    content: text("content")
      .notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_messages_channel_created")
      .on(
        table.channelId,
        table.createdAt,
      ),

    index("channel_messages_agent_idx")
      .on(table.agentId),
  ],
);