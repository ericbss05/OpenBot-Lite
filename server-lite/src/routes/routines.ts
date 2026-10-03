import { Hono } from "hono";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { AuditStore } from "../gateway/audit";
import type { RoutineStore } from "../routines/store";

export function createRoutineRoutes(deps: {
  routines: RoutineStore;
  audit: AuditStore;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get("/", async (c) => {
    return c.json(
      await deps.routines.list(),
    );
  });

  app.post("/", async (c) => {
    const user = requireUser(c);

    const id =
      await deps.routines.create(
        await c.req.json(),
      );

    await deps.audit.record(
      "routine.created",
      user.id,
      { routineId: id },
    );

    return c.json(
      { id },
      201,
    );
  });

  return app;
}
