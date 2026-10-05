import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("verification_identifier_idx").on(
      table.identifier,
    ),
  ],
);

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean("email_verified")
      .default(false)
      .notNull(),
    image: text(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp(
      "access_token_expires_at",
      {
        mode: "string",
      },
    ),
    refreshTokenExpiresAt: timestamp(
      "refresh_token_expires_at",
      {
        mode: "string",
      },
    ),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
    }).notNull(),
  },
  (table) => [
    index("account_userId_idx").on(table.userId),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
    }).notNull(),
    token: text().notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
    }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_user_id_fk",
    }).onDelete("cascade"),

    unique("session_token_unique").on(table.token),
  ],
);

export const actionPolicy = pgTable(
  "action_policy",
  {
    id: text().primaryKey().notNull(),
    mode: text().notNull(),
    deny: text().notNull(),
    allow: text().notNull(),
  },
);

export const pluginServers = pgTable(
  "plugin_servers",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    transport: text().notNull(),
    command: text().notNull(),
    args: text().notNull(),
    enabled: boolean().notNull(),
  },
);

export const workItems = pgTable(
  "work_items",
  {
    id: text().primaryKey().notNull(),
    kind: text().notNull(),
    key: text().notNull(),
    payload: text().notNull(),
    status: text().notNull(),
    leaseUntil: timestamp("lease_until", {
      mode: "string",
    }),
    attempts: integer().notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_work_items_queue").on(
      table.status,
      table.leaseUntil,
    ),

    uniqueIndex("work_items_kind_key").on(
      table.kind,
      table.key,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text().primaryKey().notNull(),
    type: text().notNull(),
    actorId: text("actor_id").notNull(),
    payload: text().notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_actor_idx").on(table.actorId),

    index("idx_audit_created").on(
      table.createdAt,
    ),

    foreignKey({
      columns: [table.actorId],
      foreignColumns: [user.id],
      name: "audit_events_actor_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    threadId: text("thread_id").notNull(),
    active: boolean().notNull(),
    lastMessageAt: timestamp("last_message_at", {
      mode: "string",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    index("channels_thread_idx").on(
      table.threadId,
    ),

    index("channels_user_idx").on(
      table.userId,
    ),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "channels_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id: text().primaryKey().notNull(),

    runId: text("run_id").notNull(),

    toolCallId: text("tool_call_id").notNull(),

    type: text().notNull(),

    question: text().notNull(),

    options: text(),

    status: text().notNull().default("pending"),

    answer: text(),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    answeredAt: timestamp("answered_at", {
      mode: "string",
    }),
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

export const approvals = pgTable(
  "approvals",
  {
    id: text().primaryKey().notNull(),

    runId: text("run_id").notNull(),

    toolCallId: text("tool_call_id").notNull(),

    toolId: text("tool_id").notNull(),

    arguments: text().notNull(),

    actorId: text("actor_id").notNull(),

    status: text().notNull().default("pending"),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    decidedAt: timestamp("decided_at", {
      mode: "string",
    }),
  },
  (table) => [
    uniqueIndex("approvals_tool_call_idx").on(
      table.toolCallId,
    ),

    index("approvals_run_idx").on(
      table.runId,
    ),

    index("approvals_actor_idx").on(
      table.actorId,
    ),

    index("approvals_status_idx").on(
      table.status,
    ),
  ],
);

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: text().primaryKey().notNull(),

    name: text().notNull(),

    title: text(),

    roleDescription: text("role_description"),

    visibility: text().notNull(),

    endpoint: text(),

    ownerUserId: text("owner_user_id"),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    model: text().notNull(),

    avatarPalette: integer("avatar_palette")
      .default(0)
      .notNull(),

    avatarReversed: boolean("avatar_reversed")
      .default(false)
      .notNull(),
  },
  (table) => [
    index("agent_profiles_owner_user_idx").on(
      table.ownerUserId,
    ),

    foreignKey({
      columns: [table.ownerUserId],
      foreignColumns: [user.id],
      name: "agent_profiles_owner_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const channelMessages = pgTable(
  "channel_messages",
  {
    id: text().primaryKey().notNull(),

    channelId: text("channel_id").notNull(),

    role: text().notNull(),

    agentId: text("agent_id"),

    interactionId: text("interaction_id"),

    approvalId: text("approval_id"),

    content: text().notNull(),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channel_messages_agent_idx").on(
      table.agentId,
    ),

    index("idx_messages_channel_created").on(
      table.channelId,
      table.createdAt,
    ),

    index("channel_messages_interaction_idx").on(
      table.interactionId,
    ),

    index("channel_messages_approval_idx").on(
      table.approvalId,
    ),

    foreignKey({
      columns: [table.channelId],
      foreignColumns: [channels.id],
      name: "channel_messages_channel_id_channels_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agentProfiles.id],
      name: "channel_messages_agent_id_agent_profiles_id_fk",
    }).onDelete("set null"),

    foreignKey({
      columns: [table.interactionId],
      foreignColumns: [interactions.id],
      name: "channel_messages_interaction_id_interactions_id_fk",
    }).onDelete("set null"),

    foreignKey({
      columns: [table.approvalId],
      foreignColumns: [approvals.id],
      name: "channel_messages_approval_id_approvals_id_fk",
    }).onDelete("set null"),
  ],
);

export const routines = pgTable(
  "routines",
  {
    id: text().primaryKey().notNull(),

    name: text().notNull(),

    cron: text().notNull(),

    channelId: text("channel_id").notNull(),

    agentId: text("agent_id").notNull(),

    prompt: text().notNull(),

    enabled: boolean().notNull(),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),

    userId: text("user_id"),
  },
  (table) => [
    index("routines_agent_idx").on(
      table.agentId,
    ),

    index("routines_channel_idx").on(
      table.channelId,
    ),

    index("routines_user_idx").on(
      table.userId,
    ),

    foreignKey({
      columns: [table.channelId],
      foreignColumns: [channels.id],
      name: "routines_channel_id_channels_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agentProfiles.id],
      name: "routines_agent_id_agent_profiles_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "routines_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const channelAgents = pgTable(
  "channel_agents",
  {
    channelId: text("channel_id").notNull(),

    agentId: text("agent_id").notNull(),

    role: text().notNull(),

    createdAt: timestamp("created_at", {
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channel_agents_agent_idx").on(
      table.agentId,
    ),

    uniqueIndex(
      "channel_agents_channel_agent_idx",
    ).on(
      table.channelId,
      table.agentId,
    ),

    index("channel_agents_channel_idx").on(
      table.channelId,
    ),

    foreignKey({
      columns: [table.channelId],
      foreignColumns: [channels.id],
      name: "channel_agents_channel_id_channels_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.agentId],
      foreignColumns: [agentProfiles.id],
      name: "channel_agents_agent_id_agent_profiles_id_fk",
    }).onDelete("cascade"),
  ],
);