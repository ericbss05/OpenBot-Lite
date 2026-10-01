import { eq } from "drizzle-orm";

import type { Db } from "../db";
import { agentProfiles } from "../db/schema";

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

      return {
        id: row.id,
        name: row.name,
        instructions:
          row.roleDescription ?? "",
        model: row.model,
        tools: [],
        subAgents: [],
      };
    },
  };
}