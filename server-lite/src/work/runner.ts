import type { LLMMessage } from "../agent/llm/provider";
import type { AgentRuntime } from "../agent/runtime/runtime";
import type { ChannelStore } from "../channels/store";
import type { AuditStore } from "../gateway/audit";
import type { WorkQueue } from "./queue";

export type TurnRunner =
  ReturnType<typeof createTurnRunner>;

export function createTurnRunner(deps: {
  queue: WorkQueue;
  channels: ChannelStore;
  audit: AuditStore;

  /**
   * Crée un runtime pour l'utilisateur
   * qui déclenche le turn.
   *
   * Le runtime reçoit son actorId afin que
   * les tools exécutés puissent être associés
   * au bon utilisateur.
   */
  createRuntime: (
    actorId: string,
  ) => AgentRuntime;

  pollMs?: number;
}) {
  const pollMs =
    deps.pollMs ?? 500;

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
      payload.actorId ?? "",
    );

    if (!channelId) {
      throw new Error(
        "Channel turn is missing channelId.",
      );
    }

    if (!agentId) {
      throw new Error(
        "Channel turn is missing agentId.",
      );
    }

    if (!actorId) {
      throw new Error(
        "Channel turn is missing actorId.",
      );
    }

    // --------------------------------------------------
    // Channel
    // --------------------------------------------------

    const channel =
      await deps.channels.getOwned(
        channelId,
        actorId,
      );

    if (!channel) {
      throw new Error(
        `Channel "${channelId}" not found.`,
      );
    }

    if (!channel.active) {
      throw new Error(
        `Channel "${channelId}" is inactive.`,
      );
    }

    // --------------------------------------------------
    // History
    // --------------------------------------------------

    const history =
      await deps.channels.history(
        channelId,
        40,
      );

    if (history.length === 0) {
      throw new Error(
        `Channel "${channelId}" has no messages.`,
      );
    }

    /*
     * channel_messages utilise les rôles :
     *
     * user | assistant | system
     *
     * Le runtime LLM utilise :
     *
     * user | assistant | tool
     *
     * Les messages "system" ne sont donc pas
     * envoyés ici. Les instructions système de
     * l'agent sont déjà fournies séparément par
     * AgentRuntime → LLMProvider.
     */
    const messages: LLMMessage[] = [];

for (const message of history) {
  if (
    message.role === "user" ||
    message.role === "assistant"
  ) {
    messages.push({
      role: message.role,
      content: message.content,
    });
  }
}

    if (messages.length === 0) {
      throw new Error(
        `Channel "${channelId}" has no usable messages.`,
      );
    }

    // --------------------------------------------------
    // Runtime
    // --------------------------------------------------

    const runtime =
      deps.createRuntime(actorId);

    const result =
      await runtime.run(
        agentId,
        messages,
      );

    // --------------------------------------------------
    // Runtime failed
    // --------------------------------------------------

    if (
      result.status === "failed"
    ) {
      throw new Error(
        result.error ??
          `Agent "${agentId}" runtime failed.`,
      );
    }

    // --------------------------------------------------
    // Runtime waiting for approval
    // --------------------------------------------------

    if (
      result.status === "waiting"
    ) {
      await deps.audit.record(
        "channel.agent_waiting",
        actorId,
        {
          channelId,
          agentId,
          runId: result.runId,
          pendingApprovalId:
            result.pendingApprovalId ??
            null,
        },
      );

      return;
    }

    // --------------------------------------------------
    // Unexpected runtime status
    // --------------------------------------------------

    if (
      result.status !== "completed"
    ) {
      throw new Error(
        `Agent runtime ended with status "${result.status}".`,
      );
    }

    // --------------------------------------------------
    // Assistant response
    // --------------------------------------------------

    const reply =
      result.result?.trim();

    if (!reply) {
      throw new Error(
        `Agent "${agentId}" completed without a response.`,
      );
    }

    // --------------------------------------------------
    // Save assistant response
    // --------------------------------------------------

    await deps.channels.appendMessage({
      channelId,
      role: "assistant",
      content: reply,
      agentId,
    });

    // --------------------------------------------------
    // Audit
    // --------------------------------------------------

    await deps.audit.record(
      "channel.agent_replied",
      actorId,
      {
        channelId,
        agentId,
        runId: result.runId,
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

      await Bun.sleep(
        pollMs,
      );
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