import { relations } from "drizzle-orm";

import {
  user,
  session,
  account,
} from "./auth";

import {
  agentProfiles,
} from "./agents";

import {
  channels,
  channelAgents,
  channelMessages,
} from "./channels";

import {
  routines,
} from "./routines";

import {
  auditEvents,
} from "./audit";

import {
  toolCatalog,
  agentTools,
} from "./tools";
// ============================================================
// User
// ============================================================

export const userRelations =
  relations(
    user,
    ({ many }) => ({
      sessions: many(session),
      accounts: many(account),
      agents: many(agentProfiles),
      channels: many(channels),
      routines: many(routines),
      auditEvents: many(auditEvents),
    }),
  );

// ============================================================
// Session
// ============================================================

export const sessionRelations =
  relations(
    session,
    ({ one }) => ({
      user: one(user, {
        fields: [session.userId],
        references: [user.id],
      }),
    }),
  );

// ============================================================
// Account
// ============================================================

export const accountRelations =
  relations(
    account,
    ({ one }) => ({
      user: one(user, {
        fields: [account.userId],
        references: [user.id],
      }),
    }),
  );

// ============================================================
// Agent
// ============================================================

export const agentProfileRelations =
  relations(
    agentProfiles,
    ({ one, many }) => ({
      owner: one(user, {
        fields: [
          agentProfiles.ownerUserId,
        ],
        references: [user.id],
      }),

      channelAssignments: many(
        channelAgents,
      ),

      messages: many(
        channelMessages,
      ),

      routines: many(routines),

      tools: many(agentTools),
    }),
  );

// ============================================================
// Channel
// ============================================================

export const channelRelations =
  relations(
    channels,
    ({ one, many }) => ({
      user: one(user, {
        fields: [channels.userId],
        references: [user.id],
      }),

      agents: many(
        channelAgents,
      ),

      messages: many(
        channelMessages,
      ),

      routines: many(routines),
    }),
  );

// ============================================================
// Channel Agent
// ============================================================

export const channelAgentRelations =
  relations(
    channelAgents,
    ({ one }) => ({
      channel: one(channels, {
        fields: [
          channelAgents.channelId,
        ],
        references: [channels.id],
      }),

      agent: one(agentProfiles, {
        fields: [
          channelAgents.agentId,
        ],
        references: [
          agentProfiles.id,
        ],
      }),
    }),
  );

// ============================================================
// Channel Message
// ============================================================

export const channelMessageRelations =
  relations(
    channelMessages,
    ({ one }) => ({
      channel: one(channels, {
        fields: [
          channelMessages.channelId,
        ],
        references: [channels.id],
      }),

      agent: one(agentProfiles, {
        fields: [
          channelMessages.agentId,
        ],
        references: [
          agentProfiles.id,
        ],
      }),
    }),
  );

// ============================================================
// Routine
// ============================================================

export const routineRelations =
  relations(
    routines,
    ({ one }) => ({
      user: one(user, {
        fields: [routines.userId],
        references: [user.id],
      }),

      channel: one(channels, {
        fields: [
          routines.channelId,
        ],
        references: [channels.id],
      }),

      agent: one(agentProfiles, {
        fields: [
          routines.agentId,
        ],
        references: [
          agentProfiles.id,
        ],
      }),
    }),
  );

// ============================================================
// Audit
// ============================================================

export const auditEventRelations =
  relations(
    auditEvents,
    ({ one }) => ({
      actor: one(user, {
        fields: [
          auditEvents.actorId,
        ],
        references: [user.id],
      }),
    }),
  );

  // ============================================================
// Agent Tool
// ============================================================

export const agentToolRelations =
  relations(
    agentTools,
    ({ one }) => ({
      agent: one(agentProfiles, {
        fields: [
          agentTools.agentId,
        ],
        references: [
          agentProfiles.id,
        ],
      }),

      tool: one(toolCatalog, {
        fields: [
          agentTools.toolId,
        ],
        references: [
          toolCatalog.id,
        ],
      }),
    }),
  );

  // ============================================================
// Tool Catalog
// ============================================================

export const toolCatalogRelations =
  relations(
    toolCatalog,
    ({ many }) => ({
      agents: many(agentTools),
    }),
  );