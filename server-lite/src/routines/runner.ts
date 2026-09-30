import { CronExpressionParser } from "cron-parser";
import type { ChannelStore } from "../channels/store";
import type { WorkQueue } from "../work/queue";
import type { RoutineStore } from "./store";

export function createRoutineRunner(deps: {
  routines: RoutineStore;
  channels: ChannelStore;
  queue: WorkQueue;
  tickMs?: number;
}) {
  const tickMs = deps.tickMs ?? 30_000;
  const lastFire = new Map<string, number>();
  let stopped = false;

  async function tick() {
    const rows = await deps.routines.list();
    const now = Date.now();
    for (const r of rows) {
      if (!r.enabled) continue;
      try {
        const interval = CronExpressionParser.parse(r.cron);
        const prev = interval.prev().getTime();
        const last = lastFire.get(r.id) ?? 0;
        if (prev <= last) continue;
        lastFire.set(r.id, now);
        await deps.channels.appendMessage({
          channelId: r.channelId,
          role: "user",
          content: r.prompt,
        });
        await deps.queue.offer("channel.turn", `${r.channelId}:${prev}`, {
          channelId: r.channelId,
          agentId: r.agentId,
          actorId: "routine",
        });
      } catch {
        // cron invalide : ignoré jusqu'à correction
      }
    }
  }

  async function loop() {
    while (!stopped) {
      await tick();
      await Bun.sleep(tickMs);
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
