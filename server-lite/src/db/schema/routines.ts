import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agentProfiles } from "./agents";
import { channels } from "./channels";

export const routines = pgTable(
  "routines",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    cron: text("cron").notNull(),

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

    prompt: text("prompt").notNull(),

    enabled: boolean("enabled").notNull(),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("routines_user_idx").on(
      table.userId,
    ),

    index("routines_channel_idx").on(
      table.channelId,
    ),

    index("routines_agent_idx").on(
      table.agentId,
    ),
  ],
);