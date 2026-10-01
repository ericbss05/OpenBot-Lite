import { randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
} from "node:fs";

import { and, eq } from "drizzle-orm";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { Db } from "../db";
import {
  agentProfiles,
  channelAgents,
  channels,
} from "../db/schema";

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

  roleDescription: z.string().optional(),

  visibility: z.enum([
    "public",
    "private",
  ]),

  endpoint: z
    .string()
    .url()
    .optional(),

  avatarPalette: z
    .number()
    .int()
    .min(0)
    .optional(),

  avatarReversed:
    z.boolean().optional(),
});

const updateSchema = z.object({
  name: z
    .string()
    .min(1)
    .optional(),

  title: z
    .string()
    .nullable()
    .optional(),

  roleDescription: z
    .string()
    .nullable()
    .optional(),

  model: z
    .string()
    .min(1)
    .optional(),

  visibility: z
    .enum([
      "public",
      "private",
    ])
    .optional(),

  endpoint: z
    .string()
    .url()
    .nullable()
    .optional(),

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
  function validateEndpoint(
    endpoint: string,
  ): string {
    const verdict =
      checkAgentEndpoint(
        endpoint,
        allowPrivateHosts,
      );

    if (!verdict.allowed) {
      throw new Error(
        verdict.reason,
      );
    }

    return verdict.url;
  }

  async function list(
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
  }

  async function get(
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
  }

  async function getOwned(
    id: string,
    ownerUserId: string,
  ): Promise<AgentProfile | null> {
    const rows =
      await db
        .select()
        .from(agentProfiles)
        .where(
          and(
            eq(
              agentProfiles.id,
              id,
            ),
            eq(
              agentProfiles.ownerUserId,
              ownerUserId,
            ),
          ),
        )
        .limit(1);

    return rows[0]
      ? mapRow(rows[0])
      : null;
  }

async function create(
  input: z.infer<typeof createSchema>,
  ownerUserId: string,
): Promise<AgentProfile> {
  const parsed = createSchema.parse(input);

  const endpoint = parsed.endpoint
    ? validateEndpoint(parsed.endpoint)
    : null;

  const now = new Date();

  const agentId = randomUUID();
  const channelId = randomUUID();
  const threadId = randomUUID();

  const agentRow = {
    id: agentId,

    name: parsed.name,

    title:
      parsed.title ?? null,

    roleDescription:
      parsed.roleDescription ?? null,

    model: "gpt-6-luna",

    visibility: "private" as const,

    endpoint,

    avatarPalette:
      parsed.avatarPalette ?? 0,

    avatarReversed:
      parsed.avatarReversed ?? false,

    ownerUserId,

    createdAt: now,
  };

  await db.transaction(async (tx) => {
    // 1. Create the agent
    await tx
      .insert(agentProfiles)
      .values(agentRow);

    // 2. Create its default channel
    await tx
      .insert(channels)
      .values({
        id: channelId,
        name: "General",
        threadId,
        active: true,
        lastMessageAt: null,
        createdAt: now,
        userId: ownerUserId,
      });

    // 3. Attach the new agent as primary
    await tx
      .insert(channelAgents)
      .values({
        channelId,
        agentId,
        role: "primary",
        createdAt: now,
      });
  });

  return mapRow(agentRow);
}

  async function update(
    id: string,
    input: z.infer<
      typeof updateSchema
    >,
  ): Promise<AgentProfile | null> {
    const parsed =
      updateSchema.parse(input);

    const existing =
      await get(id);

    if (!existing) {
      return null;
    }

    const endpoint =
      resolveEndpoint(
        parsed.endpoint,
        existing.endpoint,
        allowPrivateHosts
      );

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
  }

  async function updateOwned(
    id: string,
    ownerUserId: string,
    input: z.infer<
      typeof updateSchema
    >,
  ): Promise<AgentProfile | null> {
    const parsed =
      updateSchema.parse(input);

    const existing =
      await getOwned(
        id,
        ownerUserId,
      );

    if (!existing) {
      return null;
    }

    const endpoint =
      resolveEndpoint(
        parsed.endpoint,
        existing.endpoint,
        allowPrivateHosts
      );

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
          and(
            eq(
              agentProfiles.id,
              id,
            ),
            eq(
              agentProfiles.ownerUserId,
              ownerUserId,
            ),
          ),
        )
        .returning();

    return row
      ? mapRow(row)
      : null;
  }

  async function remove(
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
  }

  async function deleteOwned(
    id: string,
    ownerUserId: string,
  ): Promise<boolean> {
    const result =
      await db
        .delete(agentProfiles)
        .where(
          and(
            eq(
              agentProfiles.id,
              id,
            ),
            eq(
              agentProfiles.ownerUserId,
              ownerUserId,
            ),
          ),
        )
        .returning({
          id: agentProfiles.id,
        });

    return result.length > 0;
  }

  async function syncFromYaml(
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

    for (const agent of
      doc.agents ?? []) {
      const existing =
        await get(agent.id);

      let endpoint:
        | string
        | null = null;

      if (agent.endpoint) {
        try {
          endpoint =
            validateEndpoint(
              agent.endpoint,
            );
        } catch {
          continue;
        }
      }

      if (existing) {
        await db
          .update(agentProfiles)
          .set({
            name: agent.name,

            title: agent.title,

            roleDescription:
              agent.roleDescription,

            visibility:
              agent.visibility,

            endpoint,

            model:
              agent.model ??
              "gpt-6-luna",
          })
          .where(
            eq(
              agentProfiles.id,
              agent.id,
            ),
          );
      } else {
        await db
          .insert(agentProfiles)
          .values({
            id: agent.id,

            name: agent.name,

            title: agent.title,

            roleDescription:
              agent.roleDescription,

            model:
              agent.model ??
              "gpt-6-luna",

            visibility:
              agent.visibility,

            endpoint,

            avatarPalette: 0,

            avatarReversed: false,

            ownerUserId: null,

            createdAt: new Date(),
          });
      }
    }
  }

  return {
    list,
    get,
    getOwned,
    create,
    update,
    updateOwned,
    delete: remove,
    deleteOwned,
    syncFromYaml,
  };
}

function resolveEndpoint(
  value: string | null | undefined,
  current: string | null,
  allowPrivateHosts: boolean,
): string | null {
  if (value === undefined) {
    return current;
  }

  if (value === null) {
    return null;
  }

  const verdict =
    checkAgentEndpoint(
      value,
      allowPrivateHosts,
    );

  if (!verdict.allowed) {
    throw new Error(
      verdict.reason,
    );
  }

  return verdict.url;
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