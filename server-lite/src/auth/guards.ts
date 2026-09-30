import type { Context, MiddlewareHandler } from "hono";
import { auth } from "./auth";

export type AppUser = typeof auth.$Infer.Session.user;

export type AppVariables = {
  user: AppUser;
};

export function createAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", session.user);
    await next();
  };
}

export function requireUser(c: Context<{ Variables: AppVariables }>) {
  return c.get("user");
}
