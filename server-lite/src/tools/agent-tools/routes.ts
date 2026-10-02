import { Hono } from "hono";

import type { AgentStore } from "../../agent-profiles/store";
import type { AppVariables } from "../../auth/guards";
import { requireUser } from "../../auth/guards";
import { createAgentToolStore } from "./store";

export function createAgentToolRoutes(
  db: Parameters<typeof createAgentToolStore>[0],
  agents: AgentStore,
) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  const agentTools =
    createAgentToolStore(db);

  // GET /api/agents/:agentId/tools
  app.get("/:agentId/tools", async (c) => {
    const user = requireUser(c);
    const agentId = c.req.param("agentId");

    const agent =
      await agents.getOwned(
        agentId,
        user.id,
      );

    if (!agent) {
      return c.json(
        {
          error: "Agent not found",
        },
        404,
      );
    }

    const tools =
      await agentTools.list(agentId);

    return c.json({
      tools,
    });
  });

  // POST /api/agents/:agentId/tools
  app.post("/:agentId/tools", async (c) => {
    const user = requireUser(c);
    const agentId = c.req.param("agentId");

    const agent =
      await agents.getOwned(
        agentId,
        user.id,
      );

    if (!agent) {
      return c.json(
        {
          error: "Agent not found",
        },
        404,
      );
    }

    const body = await c.req.json<{
      toolId?: unknown;
    }>();

    if (
      typeof body.toolId !== "string" ||
      body.toolId.length === 0
    ) {
      return c.json(
        {
          error: "toolId is required",
        },
        400,
      );
    }

    const exists =
      await agentTools.toolExists(
        body.toolId,
      );

    if (!exists) {
      return c.json(
        {
          error: "Tool not found",
        },
        404,
      );
    }

    try {
      const result =
        await agentTools.add(
          agentId,
          body.toolId,
        );

      return c.json(
        {
          tool: result,
        },
        201,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(
          "agent_tools_agent_tool_idx",
        )
      ) {
        return c.json(
          {
            error:
              "Tool already assigned to this agent",
          },
          409,
        );
      }

      throw error;
    }
  });

  // DELETE /api/agents/:agentId/tools/:toolId
  app.delete(
    "/:agentId/tools/:toolId",
    async (c) => {
      const user = requireUser(c);
      const agentId =
        c.req.param("agentId");
      const toolId =
        c.req.param("toolId");

      const agent =
        await agents.getOwned(
          agentId,
          user.id,
        );

      if (!agent) {
        return c.json(
          {
            error: "Agent not found",
          },
          404,
        );
      }

      const removed =
        await agentTools.remove(
          agentId,
          toolId,
        );

      if (!removed) {
        return c.json(
          {
            error:
              "Tool assignment not found",
          },
          404,
        );
      }

      return c.json({
        success: true,
      });
    },
  );

  return app;
}