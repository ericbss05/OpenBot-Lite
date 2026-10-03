import { Hono } from "hono";
import { z } from "zod";

import {
  requireUser,
  type AppVariables,
} from "../auth/guards";
import type { ChannelService } from "../channels/service";
import type { AuditStore } from "../gateway/audit";
import type { WorkQueue } from "../work/queue";

export function createChannelRoutes(deps: {
  channels: ChannelService;
  audit: AuditStore;
  queue: WorkQueue;
}) {
  const app = new Hono<{
    Variables: AppVariables;
  }>();

  app.get("/", async (c) => {
    const user = requireUser(c);

    return c.json(
      await deps.channels.list(user.id),
    );
  });

  app.post("/", async (c) => {
    const user = requireUser(c);

    const body = z
      .object({
        name: z.string().min(1),
        agents: z
          .array(
            z.object({
              agentId: z.string().min(1),
              role: z.enum([
                "primary",
                "subagent",
              ]),
            }),
          )
          .min(1),
      })
      .parse(await c.req.json());

    try {
      const channel =
        await deps.channels.create(
          body,
          user.id,
        );

      await deps.audit.record(
        "channel.created",
        user.id,
        { channelId: channel.id },
      );

      return c.json(channel, 201);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to create channel",
        },
        400,
      );
    }
  });

  app.get("/:id", async (c) => {
    const user = requireUser(c);
    const channelId =
      c.req.param("id");

    const channel =
      await deps.channels.get(
        channelId,
        user.id,
      );

    if (!channel) {
      return c.json(
        { error: "Channel not found" },
        404,
      );
    }

    return c.json(channel);
  });

  app.patch("/:id", async (c) => {
    const user = requireUser(c);
    const channelId =
      c.req.param("id");

    const body = z
      .object({
        name: z.string().min(1).optional(),
        active: z.boolean().optional(),
        agents: z
          .array(
            z.object({
              agentId: z.string().min(1),
              role: z.enum([
                "primary",
                "subagent",
              ]),
            }),
          )
          .min(1)
          .optional(),
      })
      .parse(await c.req.json());

    try {
      const channel =
        await deps.channels.update(
          channelId,
          user.id,
          body,
        );

      if (!channel) {
        return c.json(
          { error: "Channel not found" },
          404,
        );
      }

      await deps.audit.record(
        "channel.updated",
        user.id,
        { channelId: channel.id },
      );

      return c.json(channel);
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update channel",
        },
        400,
      );
    }
  });

  app.delete("/:id", async (c) => {
    const user = requireUser(c);
    const channelId =
      c.req.param("id");

    try {
      const deleted =
        await deps.channels.delete(
          channelId,
          user.id,
        );

      if (!deleted) {
        return c.json(
          { error: "Channel not found" },
          404,
        );
      }

      await deps.audit.record(
        "channel.deleted",
        user.id,
        { channelId },
      );

      return c.json({
        success: true,
      });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to delete channel",
        },
        400,
      );
    }
  });

  app.get(
    "/:id/messages",
    async (c) => {
      const user = requireUser(c);
      const channelId =
        c.req.param("id");

      const history =
        await deps.channels.getHistory(
          channelId,
          user.id,
        );

      if (history === null) {
        return c.json(
          { error: "Channel not found" },
          404,
        );
      }

      return c.json(history);
    },
  );

  app.post(
    "/:id/messages",
    async (c) => {
      const user = requireUser(c);
      const channelId =
        c.req.param("id");

      const body = z
        .object({
          content: z.string().min(1),
          agentId: z.string().optional(),
        })
        .parse(await c.req.json());

      try {
        const result =
          await deps.channels.sendMessage(
            {
              channelId,
              content: body.content,
            },
            user.id,
          );

        if (!result) {
          return c.json(
            { error: "Channel not found" },
            404,
          );
        }

        const agentId =
          body.agentId ??
          result.channel.agents.find(
            (agent) =>
              agent.role === "primary",
          )?.agentId;

        if (!agentId) {
          return c.json(
            {
              error:
                "No primary agent on channel",
            },
            400,
          );
        }

        const agentExists =
          result.channel.agents.some(
            (agent) =>
              agent.agentId === agentId,
          );

        if (!agentExists) {
          return c.json(
            {
              error:
                "Agent is not attached to this channel",
            },
            400,
          );
        }

        await deps.queue.offer(
          "channel.turn",
          `${channelId}:${Date.now()}`,
          {
            channelId,
            agentId,
            actorId: user.id,
          },
        );

        return c.json(
          {
            queued: true,
            channelId,
            agentId,
          },
          202,
        );
      } catch (error) {
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to send message",
          },
          400,
        );
      }
    },
  );

  return app;
}
