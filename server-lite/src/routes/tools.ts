import { Hono } from "hono";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { ToolStore } from "../tools/store";

export function createToolRoutes(deps: {
  tools: ToolStore;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get("/", async (c) => {
    requireUser(c);

    return c.json(
      await deps.tools.list(),
    );
  });

  app.get("/:id", async (c) => {
    requireUser(c);

    const tool =
      await deps.tools.get(
        c.req.param("id"),
      );

    if (!tool) {
      return c.json(
        { error: "Tool not found" },
        404,
      );
    }

    return c.json(tool);
  });

  return app;
}
