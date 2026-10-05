import { relations } from "drizzle-orm/relations";

import {
  user,
  account,
  session,
  auditEvents,
  channels,
  channelMessages,
  agentProfiles,
  routines,
  channelAgents,
  interactions,
  approvals,
} from "../src/db/schema";

export const accountRelations = relations(
  account,
  ({ one }) => ({
    user: one(user, {
      fields: [account.userId],
      references: [user.id],
    }),
  }),
);

export const userRelations = relations(
  user,
  ({ many }) => ({
    accounts: many(account),

    sessions: many(session),

    auditEvents: many(auditEvents),

    channels: many(channels),

    routines: many(routines),

    agentProfiles: many(agentProfiles),
  }),
);

export const sessionRelations = relations(
  session,
  ({ one }) => ({
    user: one(user, {
      fields: [session.userId],
      references: [user.id],
    }),
  }),
);

export const auditEventsRelations = relations(
  auditEvents,
  ({ one }) => ({
    user: one(user, {
      fields: [auditEvents.actorId],
      references: [user.id],
    }),
  }),
);

export const channelsRelations = relations(
  channels,
  ({ one, many }) => ({
    user: one(user, {
      fields: [channels.userId],
      references: [user.id],
    }),

    channelMessages: many(channelMessages),

    routines: many(routines),

    channelAgents: many(channelAgents),
  }),
);

export const channelMessagesRelations = relations(
  channelMessages,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelMessages.channelId],
      references: [channels.id],
    }),

    agentProfile: one(agentProfiles, {
      fields: [channelMessages.agentId],
      references: [agentProfiles.id],
    }),

    interaction: one(interactions, {
      fields: [channelMessages.interactionId],
      references: [interactions.id],
    }),

    approval: one(approvals, {
      fields: [channelMessages.approvalId],
      references: [approvals.id],
    }),
  }),
);

export const interactionsRelations = relations(
  interactions,
  ({ many }) => ({
    channelMessages: many(channelMessages),
  }),
);

export const approvalsRelations = relations(
  approvals,
  ({ many }) => ({
    channelMessages: many(channelMessages),
  }),
);

export const agentProfilesRelations = relations(
  agentProfiles,
  ({ one, many }) => ({
    channelMessages: many(channelMessages),

    routines: many(routines),

    user: one(user, {
      fields: [agentProfiles.ownerUserId],
      references: [user.id],
    }),

    channelAgents: many(channelAgents),
  }),
);

export const routinesRelations = relations(
  routines,
  ({ one }) => ({
    channel: one(channels, {
      fields: [routines.channelId],
      references: [channels.id],
    }),

    agentProfile: one(agentProfiles, {
      fields: [routines.agentId],
      references: [agentProfiles.id],
    }),

    user: one(user, {
      fields: [routines.userId],
      references: [user.id],
    }),
  }),
);

export const channelAgentsRelations = relations(
  channelAgents,
  ({ one }) => ({
    channel: one(channels, {
      fields: [channelAgents.channelId],
      references: [channels.id],
    }),

    agentProfile: one(agentProfiles, {
      fields: [channelAgents.agentId],
      references: [agentProfiles.id],
    }),
  }),
);