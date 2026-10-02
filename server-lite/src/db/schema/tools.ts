import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { agentProfiles } from "./agents";

export const toolCatalog = pgTable(
  "tool_catalog",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    description: text("description").notNull(),

    source: text("source", {
      enum: ["internal", "composio"],
    }).notNull(),

    provider: text("provider"),

    requiresApproval: boolean(
      "requires_approval",
    )
      .notNull()
      .default(false),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tool_catalog_name_idx").on(
      table.name,
    ),
    index("tool_catalog_source_idx").on(
      table.source,
    ),
  ],
);

export const agentTools = pgTable(
  "agent_tools",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agentProfiles.id, {
        onDelete: "cascade",
      }),

    toolId: text("tool_id")
      .notNull()
      .references(() => toolCatalog.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_tools_agent_tool_idx").on(
      table.agentId,
      table.toolId,
    ),

    index("agent_tools_agent_idx").on(
      table.agentId,
    ),

    index("agent_tools_tool_idx").on(
      table.toolId,
    ),
  ],
);