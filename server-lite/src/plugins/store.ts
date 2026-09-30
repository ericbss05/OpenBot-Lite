import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { pluginServers } from "../db/schema";

const createSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
});

export type PluginStore = ReturnType<typeof createPluginStore>;

export function createPluginStore(db: Db) {
  return {
    async list() {
      return db.select().from(pluginServers);
    },

    async get(id: string) {
      const rows = await db
        .select()
        .from(pluginServers)
        .where(eq(pluginServers.id, id))
        .limit(1);

      return rows[0] ?? null;
    },

    async create(input: z.infer<typeof createSchema>) {
      const parsed = createSchema.parse(input);
      const id = randomUUID();

      await db.insert(pluginServers).values({
        id,
        name: parsed.name,
        transport: "stdio",
        command: parsed.command,
        args: JSON.stringify(parsed.args),
        enabled: true,
      });

      return id;
    },
  };
}
