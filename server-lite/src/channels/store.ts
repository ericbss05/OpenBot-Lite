import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db";
import { channelMessages, channels } from "../db/schema";

export type Channel = {
  id: string;
  name: string;
  threadId: string;
  agentIds: string[];
  active: boolean;
  lastMessageAt: Date | null;
  createdAt: Date;
};

export type ChannelStore = ReturnType<typeof createChannelStore>;

export function createChannelStore(db: Db) {
  return {
    async create(input: {
      name: string;
      agentIds: string[];
    }): Promise<Channel> {
      const id = randomUUID();
      const threadId = randomUUID();
      const row = {
        id,
        name: input.name,
        userId: null,
        threadId,
        agentIds: JSON.stringify(input.agentIds),
        active: true,
        lastMessageAt: null as Date | null,
        createdAt: new Date(),
      };
      await db.insert(channels).values(row);
      return mapChannel(row);
    },
    async list(): Promise<Channel[]> {
      const rows = await db
        .select()
        .from(channels)
        .orderBy(desc(channels.lastMessageAt));
      return rows.map(mapChannel);
    },
    async get(id: string): Promise<Channel | null> {
      const rows = await db
        .select()
        .from(channels)
        .where(eq(channels.id, id))
        .limit(1);
      return rows[0] ? mapChannel(rows[0]) : null;
    },
    async appendMessage(input: {
      channelId: string;
      role: "user" | "assistant" | "system";
      content: string;
      agentId?: string | null;
    }) {
      const id = randomUUID();
      const createdAt = new Date();
      await db.insert(channelMessages).values({
        id,
        channelId: input.channelId,
        role: input.role,
        agentId: input.agentId ?? null,
        content: input.content,
        createdAt,
      });
      await db
        .update(channels)
        .set({ lastMessageAt: createdAt })
        .where(eq(channels.id, input.channelId));
      return { id, createdAt };
    },
    async history(channelId: string, limit = 100) {
      return db
        .select()
        .from(channelMessages)
        .where(eq(channelMessages.channelId, channelId))
        .orderBy(channelMessages.createdAt)
        .limit(limit);
    },
  };
}

function mapChannel(row: typeof channels.$inferSelect): Channel {
  return {
    id: row.id,
    name: row.name,
    threadId: row.threadId,
    agentIds: JSON.parse(row.agentIds) as string[],
    active: row.active,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  };
}
