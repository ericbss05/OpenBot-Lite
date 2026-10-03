import { Hono } from "hono";
import { z } from "zod";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";
import type { Gateway } from "../gateway/store";

export function createAdminRoutes(deps: {
  audit: AuditStore;
  gateway: Gateway;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get(
    "/audit-events",
    async (c) => {
      return c.json(
        await deps.audit.list(100),
      );
    },
  );

  app.get(
    "/boundaries",
    (c) => {
      return c.json(
        deps.gateway.getPolicy(),
      );
    },
  );

  app.put(
    "/boundaries",
    async (c) => {
      const user = requireUser(c);

      const body = z
        .object({
          mode: z.enum([
            "enforce",
            "dry-run",
          ]),
          deny: z.array(z.string()),
          allow: z.array(z.string()),
        })
        .parse(await c.req.json());

      await deps.gateway.setPolicy(
        body,
      );

      await deps.audit.record(
        "configuration.changed",
        user.id,
        {
          area: "boundaries",
        },
      );

      return c.json(
        deps.gateway.getPolicy(),
      );
    },
  );

  return app;
}
