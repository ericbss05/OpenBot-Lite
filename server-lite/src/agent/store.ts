import { eq } from "drizzle-orm";

import type { Db } from "../db";
import {
  agentProfiles,
  agentTools,
  toolCatalog,
} from "../db/schema";

import type {
  Agent,
  AgentStore,
} from "./agent";

export type { AgentStore } from "./agent";

export function createAgentStore(
  db: Db,
): AgentStore {
  return {
    async get(
      agentId: string,
    ): Promise<Agent | null> {
      const [row] = await db
        .select({
          id: agentProfiles.id,
          name: agentProfiles.name,
          roleDescription:
            agentProfiles.roleDescription,
          model: agentProfiles.model,
          isPrimary:
            agentProfiles.isPrimary,
        })
        .from(agentProfiles)
        .where(
          eq(
            agentProfiles.id,
            agentId,
          ),
        )
        .limit(1);

      if (!row) {
        return null;
      }

      const tools = row.isPrimary
        ? await db
            .select({
              toolId: toolCatalog.id,
            })
            .from(toolCatalog)
        : await db
            .select({
              toolId: toolCatalog.id,
            })
            .from(agentTools)
            .innerJoin(
              toolCatalog,
              eq(
                agentTools.toolId,
                toolCatalog.id,
              ),
            )
            .where(
              eq(
                agentTools.agentId,
                agentId,
              ),
            );

      return {
        id: row.id,
        name: row.name,
        instructions:
          row.roleDescription ?? "",
        model: row.model,

        tools: tools.map(
          (tool) => tool.toolId,
        ),

        subAgents: [],
      };
    },
  };
}