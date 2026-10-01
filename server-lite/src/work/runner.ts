import type { AgentStore } from "../agent-profiles/store";
import {
  runAgUiTurn,
  type ChatMessage,
} from "../agent-profiles/ag-ui-client";
import type { ChannelStore } from "../channels/store";
import type { AuditStore } from "../gateway/audit";
import type { WorkQueue } from "./queue";

export type TurnRunner =
  ReturnType<typeof createTurnRunner>;

export function createTurnRunner(deps: {
  queue: WorkQueue;
  channels: ChannelStore;
  agents: AgentStore;
  audit: AuditStore;
  pollMs?: number;
}) {
  const pollMs = deps.pollMs ?? 500;

  let stopped = false;

  async function handleChannelTurn(
    payload: Record<string, unknown>,
  ) {
    const channelId = String(
      payload.channelId ?? "",
    );

    const agentId = String(
      payload.agentId ?? "",
    );

    const actorId = String(
      payload.actorId ?? "system",
    );

const channel =
  await deps.channels.getOwned(
    channelId,
    actorId,
  );

if (!channel) {
  return;
}

    const agent =
      await deps.agents.get(agentId);

    if (!agent) {
      return;
    }

    if (!agent.endpoint) {
      throw new Error(
        `Agent "${agent.id}" does not have an endpoint configured`,
      );
    }

    const history =
      await deps.channels.history(
        channelId,
        40,
      );

    const messages: ChatMessage[] =
      history.map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const reply =
      await runAgUiTurn({
        endpoint: agent.endpoint,
        threadId: channel.threadId,
        messages,
      });

    await deps.channels.appendMessage({
      channelId,
      role: "assistant",
      content: reply,
      agentId,
    });

    await deps.audit.record(
      "channel.agent_replied",
      actorId,
      {
        channelId,
        agentId,
      },
    );
  }

  async function loop() {
    while (!stopped) {
      const item =
        await deps.queue.claim(
          "channel.turn",
        );

      if (item) {
        try {
          await handleChannelTurn(
            item.payload,
          );

          await deps.queue.complete(
            item.id,
          );
        } catch (error) {
          await deps.audit.record(
  "channel.turn_failed",
  null,
  {
    error:
      error instanceof Error
        ? error.message
        : String(error),
    workId: item.id,
  },
  "system",
);

          await deps.queue.fail(
            item.id,
          );
        }
      }

      await Bun.sleep(pollMs);
    }
  }

  return {
    start() {
      void loop();
    },

    stop() {
      stopped = true;
    },
  };
}