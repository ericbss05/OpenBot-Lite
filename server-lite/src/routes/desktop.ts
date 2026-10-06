import { Hono } from "hono";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";

import type { ComputerSandboxStore } from "../agent/computer/sandbox-store";

export function createDesktopRoutes(deps: {
  computer: ComputerSandboxStore;
}) {
  const app =
    new Hono<{
      Variables: AppVariables;
    }>();

  app.get(
    "/:agentId/stream",
    async (c) => {
      requireUser(c);

      const agentId =
        c.req.param("agentId");

      if (!agentId) {
        return c.json(
          { error: "Missing agentId" },
          400,
        );
      }

      try {
        const url =
          await deps.computer.getStreamUrl(
            agentId,
            false,
          );

        return c.json({
          url,
        });
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to start desktop stream",
          },
          500,
        );
      }
    },
  );

  return app;
}