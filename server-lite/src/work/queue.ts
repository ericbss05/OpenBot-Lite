import { randomUUID } from "node:crypto";
import { and, eq, lt, or } from "drizzle-orm";
import type { Db } from "../db";
import { workItems } from "../db/schema";

const LEASE_MS = 60_000;

export type WorkItem = {
  id: string;
  kind: string;
  key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type WorkQueue = ReturnType<typeof createWorkQueue>;

export function createWorkQueue(db: Db) {
  return {
    async offer(
      kind: string,
      key: string,
      payload: Record<string, unknown>,
    ) {
      const id = randomUUID();

      try {
        await db.insert(workItems).values({
          id,
          kind,
          key,
          payload: JSON.stringify(payload),
          status: "pending",
          leaseUntil: null,
          attempts: 0,
          createdAt: new Date(),
        });
      } catch {
        // Idempotent: kind + key is unique.
      }
    },

    async claim(kind: string): Promise<WorkItem | null> {
      const now = Date.now();

      const rows = await db
        .select()
        .from(workItems)
        .where(
          and(
            eq(workItems.kind, kind),
            or(
              eq(workItems.status, "pending"),
              and(
                eq(workItems.status, "claimed"),
                lt(workItems.leaseUntil, new Date(now)),
              ),
            ),
          ),
        )
        .limit(1);

      const row = rows[0];

      if (!row) {
        return null;
      }

      const leaseUntil = new Date(now + LEASE_MS);

      await db
        .update(workItems)
        .set({
          status: "claimed",
          leaseUntil,
          attempts: row.attempts + 1,
        })
        .where(eq(workItems.id, row.id));

      return {
        id: row.id,
        kind: row.kind,
        key: row.key,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
        attempts: row.attempts + 1,
      };
    },

    async complete(id: string) {
      await db
        .update(workItems)
        .set({
          status: "done",
          leaseUntil: null,
        })
        .where(eq(workItems.id, id));
    },

    async fail(id: string) {
      await db
        .update(workItems)
        .set({
          status: "failed",
          leaseUntil: null,
        })
        .where(eq(workItems.id, id));
    },
  };
}
