import { Hono } from "hono";
import { z } from "zod";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";
import type { Gateway } from "../gateway/store";

export function createGatewayRoutes(deps: {
  gateway: Gateway;
  audit: AuditStore;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.post("/decide", async (c) => {
    const user = requireUser(c);

    const body = z
      .object({
        tool: z.object({
          name: z.string(),
        }),
        bot: z.object({
          id: z.string(),
        }),
        page: z
          .object({
            url: z.string(),
            host: z.string(),
          })
          .optional(),
      })
      .parse(await c.req.json());

    const decision =
      deps.gateway.evaluate({
        ...body,
        actor: {
          id: user.id,
        },
      });

    await deps.audit.record(
      "gateway.decided",
      user.id,
      {
        tool: body.tool.name,
        allowed: decision.allowed,
        dryRun: decision.dryRun,
      },
    );

    if (
      !decision.allowed &&
      !decision.dryRun
    ) {
      return c.json(
        decision,
        403,
      );
    }

    return c.json(decision);
  });

  return app;
}
