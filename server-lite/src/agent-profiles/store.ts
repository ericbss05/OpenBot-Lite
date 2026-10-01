import { randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
} from "node:fs";

import { eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { Db } from "../db";
import { agentProfiles } from "../db/schema";

import { checkAgentEndpoint } from "./endpoint-check";

export type AgentProfile = {
  id: string;
  name: string;
  title: string | null;
  roleDescription: string | null;
  model: string;
  visibility: "public" | "private";
  endpoint: string | null;
  avatarPalette: number;
  avatarReversed: boolean;
  ownerUserId: string | null;
  createdAt: Date;
};

const createSchema = z.object({
  name: z.string().min(1),

  title: z.string().optional(),

  roleDescription:
    z.string().optional(),

  visibility: z.enum([
    "public",
    "private",
  ]),

  endpoint:
    z.string().url().optional(),

  avatarPalette: z
    .number()
    .int()
    .min(0)
    .optional(),

  avatarReversed:
    z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),

  title: z.string().min(1).optional(),

  roleDescription:
    z.string().min(1).optional(),

  model: z.string().min(1).optional(),

  visibility: z
    .enum(["public", "private"])
    .optional(),

  endpoint:
    z.string().url().optional(),

  avatarPalette: z
    .number()
    .int()
    .min(0)
    .optional(),

  avatarReversed:
    z.boolean().optional(),
});

export type AgentStore =
  ReturnType<typeof createAgentStore>;

export function createAgentStore(
  db: Db,
  allowPrivateHosts: boolean,
) {
  return {
    /**
     * List agents owned by a user.
     */
    async list(
      ownerUserId: string,
    ): Promise<AgentProfile[]> {
      const rows =
        await db
          .select()
          .from(agentProfiles)
          .where(
            eq(
              agentProfiles.ownerUserId,
              ownerUserId,
            ),
          );

      return rows.map(mapRow);
    },

    /**
     * Get one agent by id.
     *
     * Ownership is checked at the HTTP route level
     * when the request comes from a user.
     */
    async get(
      id: string,
    ): Promise<AgentProfile | null> {
      const rows =
        await db
          .select()
          .from(agentProfiles)
          .where(
            eq(
              agentProfiles.id,
              id,
            ),
          )
          .limit(1);

      return rows[0]
        ? mapRow(rows[0])
        : null;
    },

    /**
     * Create a new agent.
     *
     * New agents are private and owned by the
     * authenticated user.
     */
    async create(
      input: z.infer<
        typeof createSchema
      >,
      ownerUserId: string,
    ): Promise<AgentProfile> {
      const parsed =
        createSchema.parse(input);

      let endpoint: string | null =
        null;

      if (parsed.endpoint) {
        const verdict =
          checkAgentEndpoint(
            parsed.endpoint,
            allowPrivateHosts,
          );

        if (!verdict.allowed) {
          throw new Error(
            verdict.reason,
          );
        }

        endpoint = verdict.url;
      }

      const id = randomUUID();

      const row = {
        id,

        name: parsed.name,

        title:
          parsed.title ?? null,

        roleDescription:
          parsed.roleDescription ??
          null,

        model: "gpt-6-luna",

        visibility:
          "private" as const,

        endpoint,

        avatarPalette:
          parsed.avatarPalette ?? 0,

        avatarReversed:
          parsed.avatarReversed ??
          false,

        ownerUserId,

        createdAt: new Date(),
      };

      await db
        .insert(agentProfiles)
        .values(row);

      return mapRow(row);
    },

    /**
     * Update an existing agent.
     */
    async update(
      id: string,
      input: z.infer<
        typeof updateSchema
      >,
    ): Promise<AgentProfile | null> {
      const parsed =
        updateSchema.parse(input);

      const existing =
        await db
          .select()
          .from(agentProfiles)
          .where(
            eq(
              agentProfiles.id,
              id,
            ),
          )
          .limit(1);

      if (!existing[0]) {
        return null;
      }

      const current =
        mapRow(existing[0]);

      let endpoint =
        current.endpoint;

      if (parsed.endpoint) {
        const verdict =
          checkAgentEndpoint(
            parsed.endpoint,
            allowPrivateHosts,
          );

        if (!verdict.allowed) {
          throw new Error(
            verdict.reason,
          );
        }

        endpoint = verdict.url;
      }

      const [row] =
        await db
          .update(agentProfiles)
          .set({
            ...(parsed.name !==
              undefined && {
              name: parsed.name,
            }),

            ...(parsed.title !==
              undefined && {
              title: parsed.title,
            }),

            ...(parsed.roleDescription !==
              undefined && {
              roleDescription:
                parsed.roleDescription,
            }),

            ...(parsed.model !==
              undefined && {
              model: parsed.model,
            }),

            ...(parsed.visibility !==
              undefined && {
              visibility:
                parsed.visibility,
            }),

            ...(parsed.endpoint !==
              undefined && {
              endpoint,
            }),

            ...(parsed.avatarPalette !==
              undefined && {
              avatarPalette:
                parsed.avatarPalette,
            }),

            ...(parsed.avatarReversed !==
              undefined && {
              avatarReversed:
                parsed.avatarReversed,
            }),
          })
          .where(
            eq(
              agentProfiles.id,
              id,
            ),
          )
          .returning();

      return row
        ? mapRow(row)
        : null;
    },

    /**
     * Delete an agent.
     */
    async delete(
      id: string,
    ): Promise<boolean> {
      const result =
        await db
          .delete(agentProfiles)
          .where(
            eq(
              agentProfiles.id,
              id,
            ),
          )
          .returning({
            id: agentProfiles.id,
          });

      return result.length > 0;
    },

    /**
     * Synchronize agents from YAML.
     */
    async syncFromYaml(
      path: string,
    ) {
      if (!existsSync(path)) {
        return;
      }

      const doc =
        parseYaml(
          readFileSync(
            path,
            "utf8",
          ),
        ) as {
          agents?: Array<{
            id: string;
            name: string;
            title: string;
            roleDescription: string;
            visibility:
              | "public"
              | "private";
            endpoint?: string;
            model?: string;
          }>;
        };

      for (const a of
        doc.agents ?? []) {
        const existing =
          await db
            .select()
            .from(agentProfiles)
            .where(
              eq(
                agentProfiles.id,
                a.id,
              ),
            )
            .limit(1);

        let endpoint: string | null =
          null;

        if (a.endpoint) {
          const verdict =
            checkAgentEndpoint(
              a.endpoint,
              allowPrivateHosts,
            );

          if (!verdict.allowed) {
            continue;
          }

          endpoint = verdict.url;
        }

        if (existing[0]) {
          await db
            .update(agentProfiles)
            .set({
              name: a.name,

              title: a.title,

              roleDescription:
                a.roleDescription,

              visibility:
                a.visibility,

              endpoint,

              model:
                a.model ??
                "gpt-6-luna",
            })
            .where(
              eq(
                agentProfiles.id,
                a.id,
              ),
            );
        } else {
          await db
            .insert(agentProfiles)
            .values({
              id: a.id,

              name: a.name,

              title: a.title,

              roleDescription:
                a.roleDescription,

              model:
                a.model ??
                "gpt-6-luna",

              visibility:
                a.visibility,

              endpoint,

              avatarPalette: 0,

              avatarReversed: false,

              ownerUserId: null,

              createdAt: new Date(),
            });
        }
      }
    },
  };
}

function mapRow(
  row: typeof agentProfiles.$inferSelect,
): AgentProfile {
  return {
    id: row.id,

    name: row.name,

    title: row.title,

    roleDescription:
      row.roleDescription,

    model: row.model,

    visibility:
      row.visibility as
        | "public"
        | "private",

    endpoint:
      row.endpoint,

    avatarPalette:
      row.avatarPalette,

    avatarReversed:
      row.avatarReversed,

    ownerUserId:
      row.ownerUserId,

    createdAt:
      row.createdAt,
  };
}