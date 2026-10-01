import { pgTable, index, text, timestamp, unique, boolean, foreignKey, uniqueIndex, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const actionPolicy = pgTable("action_policy", {
	id: text().primaryKey().notNull(),
	mode: text().notNull(),
	deny: text().notNull(),
	allow: text().notNull(),
});

export const pluginServers = pgTable("plugin_servers", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	transport: text().notNull(),
	command: text().notNull(),
	args: text().notNull(),
	enabled: boolean().notNull(),
});

export const workItems = pgTable("work_items", {
	id: text().primaryKey().notNull(),
	kind: text().notNull(),
	key: text().notNull(),
	payload: text().notNull(),
	status: text().notNull(),
	leaseUntil: timestamp("lease_until", { mode: 'string' }),
	attempts: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_work_items_queue").using("btree", table.status.asc().nullsLast().op("text_ops"), table.leaseUntil.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("work_items_kind_key").using("btree", table.kind.asc().nullsLast().op("text_ops"), table.key.asc().nullsLast().op("text_ops")),
]);

export const auditEvents = pgTable("audit_events", {
	id: text().primaryKey().notNull(),
	type: text().notNull(),
	actorId: text("actor_id").notNull(),
	payload: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_actor_idx").using("btree", table.actorId.asc().nullsLast().op("text_ops")),
	index("idx_audit_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [user.id],
			name: "audit_events_actor_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const channels = pgTable("channels", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	threadId: text("thread_id").notNull(),
	active: boolean().notNull(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	index("channels_thread_idx").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
	index("channels_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "channels_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const channelMessages = pgTable("channel_messages", {
	id: text().primaryKey().notNull(),
	channelId: text("channel_id").notNull(),
	role: text().notNull(),
	agentId: text("agent_id"),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("channel_messages_agent_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("idx_messages_channel_created").using("btree", table.channelId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "channel_messages_channel_id_channels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agentProfiles.id],
			name: "channel_messages_agent_id_agent_profiles_id_fk"
		}).onDelete("set null"),
]);

export const routines = pgTable("routines", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	cron: text().notNull(),
	channelId: text("channel_id").notNull(),
	agentId: text("agent_id").notNull(),
	prompt: text().notNull(),
	enabled: boolean().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id"),
}, (table) => [
	index("routines_agent_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	index("routines_channel_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	index("routines_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "routines_channel_id_channels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agentProfiles.id],
			name: "routines_agent_id_agent_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "routines_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const agentProfiles = pgTable("agent_profiles", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	title: text(),
	roleDescription: text("role_description"),
	visibility: text().notNull(),
	endpoint: text(),
	ownerUserId: text("owner_user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	model: text().default('gpt-6-luna').notNull(),
	avatarPalette: integer("avatar_palette").default(0).notNull(),
	avatarReversed: boolean("avatar_reversed").default(false).notNull(),
}, (table) => [
	index("agent_profiles_owner_user_idx").using("btree", table.ownerUserId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [user.id],
			name: "agent_profiles_owner_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const channelAgents = pgTable("channel_agents", {
	channelId: text("channel_id").notNull(),
	agentId: text("agent_id").notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("channel_agents_agent_idx").using("btree", table.agentId.asc().nullsLast().op("text_ops")),
	uniqueIndex("channel_agents_channel_agent_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops"), table.agentId.asc().nullsLast().op("text_ops")),
	index("channel_agents_channel_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "channel_agents_channel_id_channels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agentProfiles.id],
			name: "channel_agents_agent_id_agent_profiles_id_fk"
		}).onDelete("cascade"),
]);
