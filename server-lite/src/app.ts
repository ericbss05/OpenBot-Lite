import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { AgentStore } from "./agent-profiles/store";
import { auth } from "./auth/auth";
import type { AppVariables, createAuthMiddleware } from "./auth/guards";
import { requireUser } from "./auth/guards";
import type { ChannelStore } from "./channels/store";
import type { LiteConfig } from "./config";
import type { AuditStore } from "./gateway/audit";
import type { Gateway } from "./gateway/store";
import { callMcpTool, listMcpTools } from "./plugins/mcp";
import type { PluginStore } from "./plugins/store";
import type { RoutineStore } from "./routines/store";
import type { WorkQueue } from "./work/queue";

type Auth = ReturnType<typeof createAuthMiddleware>;

export function createApp(deps: {
  config: LiteConfig;
  auth: Auth;
  agents: AgentStore;
  channels: ChannelStore;
  gateway: Gateway;
  audit: AuditStore;
  queue: WorkQueue;
  routines: RoutineStore;
  plugins: PluginStore;
}) {
  const app = new Hono<{ Variables: AppVariables }>();

  // Allow the Next.js frontend to communicate with the Hono API.
  app.use(
    "*",
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    }),
  );

  // Better Auth routes
  app.all("/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/capabilities", (c) =>
    c.json({
      mode: "lite",
      durableHistory: true,
      generativeUi: false,
      transcription: false,
      voice: false,
      authProviders: ["emailAndPassword"],
      ssoConfigured: false,
      singleUser: deps.config.singleUser,
    }),
  );

  // All other /api routes require a Better Auth session.
  app.use("/api/*", deps.auth);

  app.get("/api/me", (c) => {
    const user = requireUser(c);
    return c.json(user);
  });

  app.get("/api/agents", async (c) => {
  const user = requireUser(c);

  return c.json(
    await deps.agents.list(user.id),
  );
});

  app.post("/api/agents", async (c) => {
    const user = requireUser(c);
    const body = await c.req.json();

    try {
      const agent = await deps.agents.create(body, user.id);

      await deps.audit.record("agent.created", user.id, {
        agentId: agent.id,
      });

      return c.json(agent, 201);
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : "Invalid",
        },
        400,
      );
    }
  });

  app.get("/api/agents/:id", async (c) => {
  const user = requireUser(c);
  const id = c.req.param("id");

  const agent = await deps.agents.get(id);

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

app.patch("/api/agents/:id", async (c) => {
  const user = requireUser(c);
  const id = c.req.param("id");
  const body = await c.req.json();

  try {
    const agent = await deps.agents.updateOwned(
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

    await deps.audit.record("agent.updated", user.id, {
      agentId: agent.id,
    });

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

app.delete("/api/agents/:id", async (c) => {
  const user = requireUser(c);
  const id = c.req.param("id");

  try {
    const deleted = await deps.agents.deleteOwned(
      id,
      user.id,
    );

    if (!deleted) {
      return c.json(
        { error: "Agent not found" },
        404,
      );
    }

    await deps.audit.record("agent.deleted", user.id, {
      agentId: id,
    });

    return c.json({ success: true });
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

  app.get("/api/channels", async (c) => {
    return c.json(await deps.channels.list());
  });

  app.post("/api/channels", async (c) => {
    const user = requireUser(c);

    const body = z
      .object({
        name: z.string().min(1),
        agentIds: z.array(z.string()).min(1),
      })
      .parse(await c.req.json());

    const channel = await deps.channels.create(body);

    await deps.audit.record("channel.created", user.id, {
      channelId: channel.id,
    });

    return c.json(channel, 201);
  });

  app.get("/api/channels/:id/messages", async (c) => {
    const id = c.req.param("id");

    return c.json(await deps.channels.history(id));
  });

  app.post("/api/channels/:id/messages", async (c) => {
    const user = requireUser(c);
    const channelId = c.req.param("id");

    const body = z
      .object({
        content: z.string().min(1),
        agentId: z.string().optional(),
      })
      .parse(await c.req.json());

    const channel = await deps.channels.get(channelId);

    if (!channel) {
      return c.json({ error: "Not found" }, 404);
    }

    const agentId = body.agentId ?? channel.agentIds[0];

    if (!agentId) {
      return c.json({ error: "No agent on channel" }, 400);
    }

    await deps.channels.appendMessage({
      channelId,
      role: "user",
      content: body.content,
    });

    await deps.queue.offer(
      "channel.turn",
      `${channelId}:${Date.now()}`,
      {
        channelId,
        agentId,
        actorId: user.id,
      },
    );

    return c.json({ queued: true }, 202);
  });

  app.get("/api/admin/audit-events", async (c) => {
    return c.json(await deps.audit.list(100));
  });

  app.get("/api/admin/boundaries", (c) => {
    return c.json(deps.gateway.getPolicy());
  });

  app.put("/api/admin/boundaries", async (c) => {
    const user = requireUser(c);

    const body = z
      .object({
        mode: z.enum(["enforce", "dry-run"]),
        deny: z.array(z.string()),
        allow: z.array(z.string()),
      })
      .parse(await c.req.json());

    await deps.gateway.setPolicy(body);

    await deps.audit.record("configuration.changed", user.id, {
      area: "boundaries",
    });

    return c.json(deps.gateway.getPolicy());
  });

  app.post("/api/gateway/decide", async (c) => {
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

    const decision = deps.gateway.evaluate({
      ...body,
      actor: {
        id: user.id,
      },
    });

    await deps.audit.record("gateway.decided", user.id, {
      tool: body.tool.name,
      allowed: decision.allowed,
      dryRun: decision.dryRun,
    });

    if (!decision.allowed && !decision.dryRun) {
      return c.json(decision, 403);
    }

    return c.json(decision);
  });

  app.get("/api/routines", async (c) => {
    return c.json(await deps.routines.list());
  });

  app.post("/api/routines", async (c) => {
    const user = requireUser(c);
    const id = await deps.routines.create(await c.req.json());

    await deps.audit.record("routine.created", user.id, {
      routineId: id,
    });

    return c.json({ id }, 201);
  });

  app.get("/api/plugins", async (c) => {
    return c.json(await deps.plugins.list());
  });

  app.post("/api/plugins", async (c) => {
    const user = requireUser(c);
    const id = await deps.plugins.create(await c.req.json());

    await deps.audit.record("plugin.registered", user.id, {
      pluginId: id,
    });

    return c.json({ id }, 201);
  });

  app.get("/api/plugins/:id/tools", async (c) => {
    const row = await deps.plugins.get(c.req.param("id"));

    if (!row || !row.enabled) {
      return c.json({ error: "Not found" }, 404);
    }

    const args = JSON.parse(row.args) as string[];
    const tools = await listMcpTools(row.command, args);

    return c.json({ tools });
  });

  app.post("/api/plugins/:id/call", async (c) => {
    const user = requireUser(c);
    const row = await deps.plugins.get(c.req.param("id"));

    if (!row || !row.enabled) {
      return c.json({ error: "Not found" }, 404);
    }

    const body = z
      .object({
        tool: z.string(),
        arguments: z.record(z.string(), z.unknown()).default({}),
        botId: z.string().default("unknown"),
      })
      .parse(await c.req.json());

    const decision = deps.gateway.evaluate({
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

    await deps.audit.record("plugin.tool_called", user.id, {
      pluginId: row.id,
      tool: body.tool,
      allowed: decision.allowed,
    });

    if (!decision.allowed && !decision.dryRun) {
      return c.json(
        {
          error: "Refused by policy",
          decision,
        },
        403,
      );
    }

    const args = JSON.parse(row.args) as string[];

    const result = await callMcpTool(
      row.command,
      args,
      body.tool,
      body.arguments,
    );

    return c.json({
      result,
      decision,
    });
  });

  return app;
}