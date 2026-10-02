import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    title: text("title"),

    roleDescription:
      text("role_description"),

    model: text("model")
  .notNull()
  .default("gpt-6-luna"),

visibility: text("visibility", {
  enum: ["public", "private"],
}).notNull(),

isPrimary: boolean("is_primary")
  .notNull()
  .default(true),

endpoint: text("endpoint"),

avatarPalette: integer("avatar_palette")
  .notNull()
  .default(0),

    avatarReversed: boolean("avatar_reversed")
      .notNull()
      .default(false),

    ownerUserId: text("owner_user_id")
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_profiles_owner_user_idx")
      .on(table.ownerUserId),
  ],
);