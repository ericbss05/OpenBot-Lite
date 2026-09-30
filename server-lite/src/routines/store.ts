import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db";
import { routines } from "../db/schema";

const createSchema = z.object({
  name: z.string().min(1),
  cron: z.string().min(1),
  channelId: z.string().min(1),
  agentId: z.string().min(1),
  prompt: z.string().min(1),
});

export type RoutineStore = ReturnType<typeof createRoutineStore>;

export function createRoutineStore(db: Db) {
  return {
    async list() {
      return db.select().from(routines);
    },

    async create(input: z.infer<typeof createSchema>) {
      const parsed = createSchema.parse(input);
      const id = randomUUID();

      await db.insert(routines).values({
        id,
        ...parsed,
        userId: null,
        enabled: true,
        createdAt: new Date(),
      });

      return id;
    },

    async setEnabled(id: string, enabled: boolean) {
      await db
        .update(routines)
        .set({ enabled })
        .where(eq(routines.id, id));
    },
  };
}
