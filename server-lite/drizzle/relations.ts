import { relations } from "drizzle-orm/relations";
import { user, account, session, agentProfiles, auditEvents, channels, channelMessages, routines } from "./schema";

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
	agentProfiles: many(agentProfiles),
	auditEvents: many(auditEvents),
	channels: many(channels),
	routines: many(routines),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const agentProfilesRelations = relations(agentProfiles, ({one, many}) => ({
	user: one(user, {
		fields: [agentProfiles.ownerUserId],
		references: [user.id]
	}),
	channelMessages: many(channelMessages),
	routines: many(routines),
}));

export const auditEventsRelations = relations(auditEvents, ({one}) => ({
	user: one(user, {
		fields: [auditEvents.actorId],
		references: [user.id]
	}),
}));

export const channelsRelations = relations(channels, ({one, many}) => ({
	user: one(user, {
		fields: [channels.userId],
		references: [user.id]
	}),
	channelMessages: many(channelMessages),
	routines: many(routines),
}));

export const channelMessagesRelations = relations(channelMessages, ({one}) => ({
	channel: one(channels, {
		fields: [channelMessages.channelId],
		references: [channels.id]
	}),
	agentProfile: one(agentProfiles, {
		fields: [channelMessages.agentId],
		references: [agentProfiles.id]
	}),
}));

export const routinesRelations = relations(routines, ({one}) => ({
	channel: one(channels, {
		fields: [routines.channelId],
		references: [channels.id]
	}),
	agentProfile: one(agentProfiles, {
		fields: [routines.agentId],
		references: [agentProfiles.id]
	}),
	user: one(user, {
		fields: [routines.userId],
		references: [user.id]
	}),
}));