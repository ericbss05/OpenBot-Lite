import { Hono } from "hono";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";

export function createHumanControlRoutes(deps: {
  resumeHumanControl: (
    runId: string,
  ) => Promise<unknown>;
}) {
  const app =
    new Hono<{
      Variables: AppVariables;
    }>();

  app.post(
    "/:runId/resume",
    async (c) => {
      const user =
        requireUser(c);

      const runId =
        c.req.param("runId");

      if (!runId) {
        return c.json(
          {
            error:
              "runId is required",
          },
          400,
        );
      }

      try {
        const result =
          await deps.resumeHumanControl(
            runId,
          );

        return c.json({
          success: true,
          runId,
          result,
        });
      } catch (error) {
        console.error(
          "[HUMAN CONTROL] Failed to resume conversation",
          {
            runId,
            userId: user.id,
            error,
          },
        );

        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to resume human control",
          },
          400,
        );
      }
    },
  );

  return app;
}    