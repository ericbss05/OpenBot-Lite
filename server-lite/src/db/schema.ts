import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================
// Better Auth
// ============================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// ============================================================
// OpenBot Lite - Agents
// ============================================================

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),
    title: text("title").notNull(),
    roleDescription: text("role_description").notNull(),

    visibility: text("visibility", {
      enum: ["public", "private"],
    }).notNull(),

    endpoint: text("endpoint").notNull(),

    ownerUserId: text("owner_user_id").references(() => user.id, {
      onDelete: "cascade",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agent_profiles_owner_user_idx").on(table.ownerUserId),
  ],
);

// ============================================================
// Channels
// ============================================================

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),
    threadId: text("thread_id").notNull(),

    // JSON array of agent IDs, preserved from the original schema.
    agentIds: text("agent_ids").notNull(),

    active: boolean("active").notNull(),

    lastMessageAt: timestamp("last_message_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("channels_user_idx").on(table.userId),
    index("channels_thread_idx").on(table.threadId),
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
      enum: ["user", "assistant", "system"],
    }).notNull(),

    agentId: text("agent_id").references(() => agentProfiles.id, {
      onDelete: "set null",
    }),

    content: text("content").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_messages_channel_created").on(
      table.channelId,
      table.createdAt,
    ),
    index("channel_messages_agent_idx").on(table.agentId),
  ],
);

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

    payload: text("payload").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_created").on(table.createdAt),
    index("audit_actor_idx").on(table.actorId),
  ],
);

// ============================================================
// Action Policy
// ============================================================

export const actionPolicy = pgTable("action_policy", {
  id: text("id").primaryKey(),

  mode: text("mode", {
    enum: ["enforce", "dry-run"],
  }).notNull(),

  deny: text("deny").notNull(),
  allow: text("allow").notNull(),
});

// ============================================================
// Routines
// ============================================================

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

    createdAt: timestamp("created_at").defaultNow().notNull(),

    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("routines_user_idx").on(table.userId),
    index("routines_channel_idx").on(table.channelId),
    index("routines_agent_idx").on(table.agentId),
  ],
);

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
      enum: ["pending", "claimed", "done", "failed"],
    }).notNull(),

    leaseUntil: timestamp("lease_until"),

    attempts: integer("attempts").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("work_items_kind_key").on(table.kind, table.key),
    index("idx_work_items_queue").on(
      table.status,
      table.leaseUntil,
    ),
  ],
);

// ============================================================
// Plugin Servers
// ============================================================

export const pluginServers = pgTable("plugin_servers", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  transport: text("transport", {
    enum: ["stdio"],
  }).notNull(),

  command: text("command").notNull(),
  args: text("args").notNull(),

  enabled: boolean("enabled").notNull(),
});

// ============================================================
// Relations
// ============================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  agents: many(agentProfiles),
  channels: many(channels),
  routines: many(routines),
  auditEvents: many(auditEvents),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const agentProfileRelations = relations(
  agentProfiles,
  ({ one, many }) => ({
    owner: one(user, {
      fields: [agentProfiles.ownerUserId],
      references: [user.id],
    }),

    messages: many(channelMessages),
    routines: many(routines),
  }),
);

export const channelRelations = relations(
  channels,
  ({ one, many }) => ({
    user: one(user, {
      fields: [channels.userId],
      references: [user.id],
    }),

    messages: many(channelMessages),
    routines: many(routines),
  }),
);

export const channelMessageRelations = relations(
  channelMessages,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelMessages.channelId],
      references: [channels.id],
    }),

    agent: one(agentProfiles, {
      fields: [channelMessages.agentId],
      references: [agentProfiles.id],
    }),
  }),
);

export const routineRelations = relations(
  routines,
  ({ one }) => ({
    user: one(user, {
      fields: [routines.userId],
      references: [user.id],
    }),

    channel: one(channels, {
      fields: [routines.channelId],
      references: [channels.id],
    }),

    agent: one(agentProfiles, {
      fields: [routines.agentId],
      references: [agentProfiles.id],
    }),
  }),
);

export const auditEventRelations = relations(
  auditEvents,
  ({ one }) => ({
    actor: one(user, {
      fields: [auditEvents.actorId],
      references: [user.id],
    }),
  }),
);