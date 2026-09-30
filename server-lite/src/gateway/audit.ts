import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import type { Db } from "../db";
import { auditEvents } from "../db/schema";

export type AuditStore = ReturnType<typeof createAuditStore>;

export function createAuditStore(db: Db) {
  return {
    async record(
      type: string,
      actorId: string,
      payload: Record<string, unknown>,
    ) {
      const row = {
        id: randomUUID(),
        type,
        actorId,
        payload: JSON.stringify(redact(payload)),
        createdAt: new Date(),
      };

      await db.insert(auditEvents).values(row);

      return row.id;
    },

    async list(limit = 50) {
      return db
        .select()
        .from(auditEvents)
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);
    },
  };
}

const SENSITIVE = new Set([
  "authorization",
  "api_key",
  "token",
  "secret",
  "password",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.has(k.toLowerCase())
        ? "[redacted]"
        : redact(v);
    }

    return out;
  }

  return value;
}