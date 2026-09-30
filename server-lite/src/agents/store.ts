import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Db } from "../db";
import { agentProfiles } from "../db/schema";
import { checkAgentEndpoint } from "./endpoint-check";

export type AgentProfile = {
  id: string;
  name: string;
  title: string;
  roleDescription: string;
  visibility: "public" | "private";
  endpoint: string;
  ownerUserId: string | null;
  createdAt: Date;
};

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  roleDescription: z.string().min(1),
  visibility: z.enum(["public", "private"]),
  endpoint: z.string().url(),
});

export type AgentStore = ReturnType<typeof createAgentStore>;

export function createAgentStore(
  db: Db,
  allowPrivateHosts: boolean,
) {
  return {
    async list(): Promise<AgentProfile[]> {
      const rows = await db.select().from(agentProfiles);
      return rows.map(mapRow);
    },
    async get(id: string): Promise<AgentProfile | null> {
      const rows = await db
        .select()
        .from(agentProfiles)
        .where(eq(agentProfiles.id, id))
        .limit(1);
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async create(input: z.infer<typeof createSchema>, ownerUserId: string) {
      const parsed = createSchema.parse(input);
      const verdict = checkAgentEndpoint(parsed.endpoint, allowPrivateHosts);
      if (!verdict.allowed) throw new Error(verdict.reason);
      const id = randomUUID();
      const row = {
        id,
        name: parsed.name,
        title: parsed.title,
        roleDescription: parsed.roleDescription,
        visibility: parsed.visibility,
        endpoint: verdict.url,
        ownerUserId: parsed.visibility === "private" ? ownerUserId : null,
        createdAt: new Date(),
      };
      await db.insert(agentProfiles).values(row);
      return mapRow(row);
    },
    async syncFromYaml(path: string) {
      if (!existsSync(path)) return;
      const doc = parseYaml(readFileSync(path, "utf8")) as {
        agents?: Array<{
          id: string;
          name: string;
          title: string;
          roleDescription: string;
          visibility: "public" | "private";
          endpoint: string;
        }>;
      };
      for (const a of doc.agents ?? []) {
        const existing = await this.get(a.id);
        const verdict = checkAgentEndpoint(a.endpoint, allowPrivateHosts);
        if (!verdict.allowed) continue;
        if (existing) {
          await db
            .update(agentProfiles)
            .set({
              name: a.name,
              title: a.title,
              roleDescription: a.roleDescription,
              visibility: a.visibility,
              endpoint: verdict.url,
            })
            .where(eq(agentProfiles.id, a.id));
        } else {
          await db.insert(agentProfiles).values({
            id: a.id,
            name: a.name,
            title: a.title,
            roleDescription: a.roleDescription,
            visibility: a.visibility,
            endpoint: verdict.url,
            ownerUserId: null,
            createdAt: new Date(),
          });
        }
      }
    },
  };
}

function mapRow(row: typeof agentProfiles.$inferSelect): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    roleDescription: row.roleDescription,
    visibility: row.visibility as "public" | "private",
    endpoint: row.endpoint,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
  };
}
