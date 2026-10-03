import { Hono } from "hono";

import type { AgentStore } from "../agent-profiles/store";
import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";

export function createAgentRoutes(deps: {
  agents: AgentStore;
  audit: AuditStore;
}) {
  const app =
    new Hono<{
      Variables: AppVariables;
    }>();

  app.get("/", async (c) => {
    const user = requireUser(c);

    return c.json(
      await deps.agents.list(user.id),
    );
  });

  app.post("/", async (c) => {
    const user = requireUser(c);
    const body = await c.req.json();

    try {
      const agent =
        await deps.agents.create(
          body,
          user.id,
        );

      await deps.audit.record(
        "agent.created",
        user.id,
        {
          agentId: agent.id,
        },
      );

      return c.json(agent, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid",
        },
        400,
      );
    }
  });

  app.get("/:id", async (c) => {
    const user = requireUser(c);
    const id = c.req.param("id");

    const agent =
      await deps.agents.get(id);

    if (!agent) {
      return c.json(
        { error: "Agent not found" },
        404,
      );
    }

    if (agent.ownerUserId !== user.id) {
      return c.json(
        { error: "Agent not found" },
        404,
      );
    }

    return c.json(agent);
  });

  app.patch("/:id", async (c) => {
    const user = requireUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();

    try {
      const agent =
        await deps.agents.updateOwned(
          id,
          user.id,
          body,
        );

      if (!agent) {
        return c.json(
          { error: "Agent not found" },
          404,
        );
      }

      await deps.audit.record(
        "agent.updated",
        user.id,
        {
          agentId: agent.id,
        },
      );

      return c.json(agent);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update agent",
        },
        400,
      );
    }
  });

  app.delete("/:id", async (c) => {
    const user = requireUser(c);
    const id = c.req.param("id");

    try {
      const deleted =
        await deps.agents.deleteOwned(
          id,
          user.id,
        );

      if (!deleted) {
        return c.json(
          { error: "Agent not found" },
          404,
        );
      }

      await deps.audit.record(
        "agent.deleted",
        user.id,
        {
          agentId: id,
        },
      );

      return c.json({
        success: true,
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete agent",
        },
        400,
      );
    }
  });

  return app;
}
