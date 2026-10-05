import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agentProfiles } from "./agents";
import { interactions } from "./interactions";
import { approvals } from "./approvals";

// ============================================================
// Channels
// ============================================================

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    threadId: text("thread_id").notNull(),

    active: boolean("active").notNull(),

    lastMessageAt: timestamp("last_message_at"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    index("channels_user_idx").on(table.userId),

    index("channels_thread_idx").on(table.threadId),
  ],
);

// ============================================================
// Channel Agents
// ============================================================

export const channelAgents = pgTable(
  "channel_agents",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
      }),

    agentId: text("agent_id")
      .notNull()
      .references(() => agentProfiles.id, {
        onDelete: "cascade",
      }),

    role: text("role", {
      enum: ["primary", "subagent"],
    }).notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("channel_agents_channel_agent_idx").on(
      table.channelId,
      table.agentId,
    ),

    index("channel_agents_channel_idx").on(
      table.channelId,
    ),

    index("channel_agents_agent_idx").on(
      table.agentId,
    ),
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

    agentId: text("agent_id").references(
      () => agentProfiles.id,
      {
        onDelete: "set null",
      },
    ),

    interactionId: text("interaction_id").references(
      () => interactions.id,
      {
        onDelete: "set null",
      },
    ),

    approvalId: text("approval_id").references(
      () => approvals.id,
      {
        onDelete: "set null",
      },
    ),

    content: text("content").notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_messages_channel_created").on(
      table.channelId,
      table.createdAt,
    ),

    index("channel_messages_agent_idx").on(
      table.agentId,
    ),

    index("channel_messages_interaction_idx").on(
      table.interactionId,
    ),

    index("channel_messages_approval_idx").on(
      table.approvalId,
    ),
  ],
);