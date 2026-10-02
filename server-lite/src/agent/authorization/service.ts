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

export interface ToolAuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export interface ToolAuthorizer {
  authorize(
    agentId: string,
    toolId: string,
  ): Promise<ToolAuthorizationResult>;
}

export class ToolAuthorizationService
  implements ToolAuthorizer
{
  constructor(
    private readonly db: Db,
  ) {}

  async authorize(
    agentId: string,
    toolId: string,
  ): Promise<ToolAuthorizationResult> {
    const [agent] =
      await this.db
        .select({
          id: agentProfiles.id,
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

    if (!agent) {
      return {
        allowed: false,
        reason:
          `Agent not found: ${agentId}`,
      };
    }

    const [tool] =
      await this.db
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

    if (!tool) {
      return {
        allowed: false,
        reason:
          `Tool not found: ${toolId}`,
      };
    }

    if (agent.isPrimary) {
      return {
        allowed: true,
      };
    }

    const [assignment] =
      await this.db
        .select({
          agentId:
            agentTools.agentId,
        })
        .from(agentTools)
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
        .limit(1);

    if (!assignment) {
      return {
        allowed: false,
        reason:
          `Agent "${agentId}" is not authorized to use tool "${toolId}".`,
      };
    }

    return {
      allowed: true,
    };
  }
}
