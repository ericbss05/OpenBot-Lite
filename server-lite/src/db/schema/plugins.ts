import {
  boolean,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

// ============================================================
// Plugin / MCP Servers
// ============================================================

export const pluginServers = pgTable(
  "plugin_servers",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    transport: text("transport", {
      enum: ["stdio"],
    }).notNull(),

    command: text("command").notNull(),

    args: text("args").notNull(),

    enabled: boolean("enabled")
      .notNull(),
  },
);