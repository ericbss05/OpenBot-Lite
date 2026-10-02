import {
  and,
  eq,
} from "drizzle-orm";

import type { Db } from "../../db";
import {
  agentProfiles,
  agentTools,
  toolCatalog,
} from "../../db/schema";

export type AgentTool = {
  agentId: string;
  toolId: string;
  createdAt: Date;
};

export function createAgentToolStore(
  db: Db,
) {
  async function list(
    agentId: string,
  ): Promise<AgentTool[]> {
    const rows =
      await db
        .select({
          agentId:
            agentTools.agentId,
          toolId:
            agentTools.toolId,
          createdAt:
            agentTools.createdAt,
        })
        .from(agentTools)
        .where(
          eq(
            agentTools.agentId,
            agentId,
          ),
        );

    return rows;
  }

  async function add(
    agentId: string,
    toolId: string,
  ): Promise<AgentTool> {
    const [row] =
      await db
        .insert(agentTools)
        .values({
          agentId,
          toolId,
        })
        .returning({
          agentId:
            agentTools.agentId,
          toolId:
            agentTools.toolId,
          createdAt:
            agentTools.createdAt,
        });

    return row;
  }

  async function remove(
    agentId: string,
    toolId: string,
  ): Promise<boolean> {
    const deleted =
      await db
        .delete(agentTools)
        .where(
          and(
            eq(
              agentTools.agentId,
              agentId,
            ),
            eq(
              agentTools.toolId,
              toolId,
            ),
          ),
        )
        .returning({
          agentId:
            agentTools.agentId,
        });

    return deleted.length > 0;
  }

  async function agentExists(
    agentId: string,
  ): Promise<boolean> {
    const [agent] =
      await db
        .select({
          id: agentProfiles.id,
        })
        .from(agentProfiles)
        .where(
          eq(
            agentProfiles.id,
            agentId,
          ),
        )
        .limit(1);

    return Boolean(agent);
  }

  async function toolExists(
    toolId: string,
  ): Promise<boolean> {
    const [tool] =
      await db
        .select({
          id: toolCatalog.id,
        })
        .from(toolCatalog)
        .where(
          eq(
            toolCatalog.id,
            toolId,
          ),
        )
        .limit(1);

    return Boolean(tool);
  }

  return {
    list,
    add,
    remove,
    agentExists,
    toolExists,
  };
}