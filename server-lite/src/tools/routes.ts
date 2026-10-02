import { Hono } from "hono";

import type { Db } from "../db";

import {
  createToolStore,
} from "./store";

export function createToolRoutes(
  db: Db,
) {
  const app = new Hono();

  const tools =
    createToolStore(db);

  // GET /tools
  app.get("/", async (c) => {
    const result =
      await tools.list();

    return c.json({
      tools: result,
    });
  });

  // GET /tools/:id
  app.get("/:id", async (c) => {
    const id =
      c.req.param("id");

    const tool =
      await tools.get(id);

    if (!tool) {
      return c.json(
        {
          error: "Tool not found",
        },
        404,
      );
    }

    return c.json({
      tool,
    });
  });

  return app;
}