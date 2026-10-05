import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
} from "drizzle-orm";

import type { Db } from "../db";
import {
  approvals,
  channelAgents,
  channelMessages,
  channels,
  interactions,
} from "../db/schema";

import type {
  Channel,
  ChannelAgent,
  ChannelMessage,
  CreateChannelInput,
  UpdateChannelInput,
} from "./types";

export type ChannelStore =
  ReturnType<typeof createChannelStore>;

export function createChannelStore(db: Db) {
  return {
    async create(
      input: CreateChannelInput,
      userId: string,
    ): Promise<Channel> {
      const id = randomUUID();
      const threadId = randomUUID();
      const createdAt = new Date();

      await db.insert(channels).values({
        id,
        name: input.name,
        userId,
        threadId,
        active: true,
        lastMessageAt: null,
        createdAt,
      });

      if (input.agents.length > 0) {
        await db.insert(channelAgents).values(
          input.agents.map((agent) => ({
            channelId: id,
            agentId: agent.agentId,
            role: agent.role,
            createdAt,
          })),
        );
      }

      return {
        id,
        userId,
        name: input.name,
        threadId,
        agents: input.agents,
        active: true,
        lastMessageAt: null,
        createdAt,
      };
    },

    async listOwned(
      userId: string,
    ): Promise<Channel[]> {
      const rows = await db
        .select()
        .from(channels)
        .where(
          eq(channels.userId, userId),
        )
        .orderBy(
          desc(channels.lastMessageAt),
        );

      const result: Channel[] = [];

      for (const row of rows) {
        const agents =
          await getChannelAgents(
            db,
            row.id,
          );

        result.push(
          mapChannel(row, agents),
        );
      }

      return result;
    },

    async getOwned(
      id: string,
      userId: string,
    ): Promise<Channel | null> {
      const rows = await db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.id, id),
            eq(channels.userId, userId),
          ),
        )
        .limit(1);

      const row = rows[0];

      if (!row) {
        return null;
      }

      const agents =
        await getChannelAgents(
          db,
          row.id,
        );

      return mapChannel(
        row,
        agents,
      );
    },

    async updateOwned(
      id: string,
      userId: string,
      input: UpdateChannelInput,
    ): Promise<Channel | null> {
      const existing =
        await this.getOwned(
          id,
          userId,
        );

      if (!existing) {
        return null;
      }

      const updatedAt =
        new Date();

      await db
        .update(channels)
        .set({
          ...(input.name !== undefined
            ? {
                name: input.name,
              }
            : {}),

          ...(input.active !== undefined
            ? {
                active: input.active,
              }
            : {}),
        })
        .where(
          and(
            eq(channels.id, id),
            eq(
              channels.userId,
              userId,
            ),
          ),
        );

      if (
        input.agents !==
        undefined
      ) {
        await db
          .delete(channelAgents)
          .where(
            eq(
              channelAgents.channelId,
              id,
            ),
          );

        if (
          input.agents.length >
          0
        ) {
          await db
            .insert(channelAgents)
            .values(
              input.agents.map(
                (agent) => ({
                  channelId: id,
                  agentId:
                    agent.agentId,
                  role:
                    agent.role,
                  createdAt:
                    updatedAt,
                }),
              ),
            );
        }
      }

      return this.getOwned(
        id,
        userId,
      );
    },

    async deleteOwned(
      id: string,
      userId: string,
    ): Promise<boolean> {
      const deleted =
        await db
          .delete(channels)
          .where(
            and(
              eq(channels.id, id),
              eq(
                channels.userId,
                userId,
              ),
            ),
          )
          .returning({
            id: channels.id,
          });

      return deleted.length > 0;
    },

    async appendMessage(input: {
      channelId: string;
      role: ChannelMessage["role"];
      content: string;
      interactionId?:
        | string
        | null;
      approvalId?:
        | string
        | null;
      agentId?:
        | string
        | null;
    }): Promise<{
      id: string;
      createdAt: Date;
    }> {
      const id = randomUUID();
      const createdAt =
        new Date();

      await db
        .insert(channelMessages)
        .values({
          id,
          channelId:
            input.channelId,
          role: input.role,
          agentId:
            input.agentId ??
            null,
          content:
            input.content,
          interactionId:
            input.interactionId ??
            null,
          approvalId:
            input.approvalId ??
            null,
          createdAt,
        });

      await db
        .update(channels)
        .set({
          lastMessageAt:
            createdAt,
        })
        .where(
          eq(
            channels.id,
            input.channelId,
          ),
        );

      return {
        id,
        createdAt,
      };
    },

    async history(
      channelId: string,
      limit = 40,
    ): Promise<ChannelMessage[]> {
      const rows = await db
        .select()
        .from(channelMessages)
        .where(
          eq(
            channelMessages.channelId,
            channelId,
          ),
        )
        .orderBy(
          asc(channelMessages.createdAt),
        )
        .limit(limit);

      return Promise.all(
        rows.map(async (row) => {
          let interaction = null;
          let approval = null;

          if (row.interactionId) {
            const [
              interactionRow,
            ] = await db
              .select()
              .from(interactions)
              .where(
                eq(
                  interactions.id,
                  row.interactionId,
                ),
              )
              .limit(1);

            interaction =
              interactionRow ?? null;
          }

          if (row.approvalId) {
            const [
              approvalRow,
            ] = await db
              .select()
              .from(approvals)
              .where(
                eq(
                  approvals.id,
                  row.approvalId,
                ),
              )
              .limit(1);

            approval =
              approvalRow ?? null;
          }

          return {
            id: row.id,
            channelId:
              row.channelId,
            role: row.role,
            content:
              row.content,
            agentId:
              row.agentId,
            interactionId:
              row.interactionId,
            approvalId:
              row.approvalId,
            interaction,
            approval,
            createdAt:
              row.createdAt,
          };
        }),
      );
    },
  };
}

async function getChannelAgents(
  db: Db,
  channelId: string,
): Promise<ChannelAgent[]> {
  const rows = await db
    .select()
    .from(channelAgents)
    .where(
      eq(
        channelAgents.channelId,
        channelId,
      ),
    );

  return rows.map((row) => ({
    agentId: row.agentId,
    role: row.role,
  }));
}

function mapChannel(
  row: typeof channels.$inferSelect,
  agents: ChannelAgent[],
): Channel {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    threadId: row.threadId,
    agents,
    active: row.active,
    lastMessageAt:
      row.lastMessageAt,
    createdAt: row.createdAt,
  };
}