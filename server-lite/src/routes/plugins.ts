import { Hono } from "hono";
import { z } from "zod";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";
import type { Gateway } from "../gateway/store";
import {
  callMcpTool,
  listMcpTools,
} from "../plugins/mcp";
import type { PluginStore } from "../plugins/store";

export function createPluginRoutes(deps: {
  plugins: PluginStore;
  gateway: Gateway;
  audit: AuditStore;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get("/", async (c) => {
    return c.json(
      await deps.plugins.list(),
    );
  });

  app.post("/", async (c) => {
    const user = requireUser(c);

    const id =
      await deps.plugins.create(
        await c.req.json(),
      );

    await deps.audit.record(
      "plugin.registered",
      user.id,
      { pluginId: id },
    );

    return c.json(
      { id },
      201,
    );
  });

  app.get(
    "/:id/tools",
    async (c) => {
      const row =
        await deps.plugins.get(
          c.req.param("id"),
        );

      if (!row || !row.enabled) {
        return c.json(
          { error: "Not found" },
          404,
        );
      }

      const args =
        JSON.parse(row.args) as string[];

      const tools =
        await listMcpTools(
          row.command,
          args,
        );

      return c.json({
        tools,
      });
    },
  );

  app.post(
    "/:id/call",
    async (c) => {
      const user = requireUser(c);

      const row =
        await deps.plugins.get(
          c.req.param("id"),
        );

      if (!row || !row.enabled) {
        return c.json(
          { error: "Not found" },
          404,
        );
      }

      const body = z
        .object({
          tool: z.string(),
          arguments: z
            .record(
              z.string(),
              z.unknown(),
            )
            .default({}),
          botId: z
            .string()
            .default("unknown"),
        })
        .parse(await c.req.json());

      const decision =
        deps.gateway.evaluate({
          tool: {
            name: body.tool,
          },
          bot: {
            id: body.botId,
          },
          actor: {
            id: user.id,
          },
        });

      await deps.audit.record(
        "plugin.tool_called",
        user.id,
        {
          pluginId: row.id,
          tool: body.tool,
          allowed: decision.allowed,
        },
      );

      if (
        !decision.allowed &&
        !decision.dryRun
      ) {
        return c.json(
          {
            error: "Refused by policy",
            decision,
          },
          403,
        );
      }

      const args =
        JSON.parse(row.args) as string[];

      const result =
        await callMcpTool(
          row.command,
          args,
          body.tool,
          body.arguments,
        );

      return c.json({
        result,
        decision,
      });
    },
  );

  return app;
}
