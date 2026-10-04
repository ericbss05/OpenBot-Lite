import type {
  UserInteraction,
} from "../llm/user-interaction";

export interface RunContext {
  runId: string;
  channelId?: string;
  agentId: string;
  actorId: string;
}

export interface EventMessage {
  id: string;
  channelId: string;
  role:
    | "user"
    | "assistant"
    | "system";
  content: string;
  agentId: string | null;
  createdAt: string;
}

export type AgentEvent =
  // ─────────────────────────────────────────────
  // Connection / channel
  // ─────────────────────────────────────────────

  | {
      type:
        "channel.connected";
      context: RunContext;
    }

  // ─────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────

  | {
      type:
        "message.created";
      context: RunContext;
      message: EventMessage;
    }

  | {
      type:
        "message.updated";
      context: RunContext;
      message: EventMessage;
    }

  // ─────────────────────────────────────────────
  // Run lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "run.started";
      context: RunContext;
    }

  | {
      type:
        "run.completed";
      context: RunContext;
    }

  | {
      type: "run.failed";
      context: RunContext;
      error: string;
    }

  // ─────────────────────────────────────────────
  // LLM lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "llm.started";
      context: RunContext;
    }

  | {
      type:
        "llm.completed";
      context: RunContext;
    }

  // ─────────────────────────────────────────────
  // Tool lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "tool.started";
      context: RunContext;
      toolCallId: string;
      toolId: string;
      arguments: Record<
        string,
        unknown
      >;
    }

  | {
      type:
        "tool.completed";
      context: RunContext;
      toolCallId: string;
      toolId: string;
      status:
        | "success"
        | "error";
      result?: unknown;
      error?: string;
    }

  // ─────────────────────────────────────────────
  // Approvals
  // ─────────────────────────────────────────────

  | {
      type:
        "approval.required";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
      arguments: Record<
        string,
        unknown
      >;
    }

  | {
      type:
        "approval.approved";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
    }

  | {
      type:
        "approval.rejected";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
    }

  // ─────────────────────────────────────────────
  // User interaction
  // ─────────────────────────────────────────────

  | {
      type:
        "user_interaction.required";
      context: RunContext;
      interaction: UserInteraction;
    }

  // ─────────────────────────────────────────────
  // Agent / sub-agent
  // ─────────────────────────────────────────────

  | {
      type: "agent.started";
      context: RunContext;
    }

  | {
      type:
        "agent.completed";
      context: RunContext;
      output: string;
    }

  | {
      type: "agent.failed";
      context: RunContext;
      error: string;
    }

  // ─────────────────────────────────────────────
  // Sub-agent lifecycle
  // ─────────────────────────────────────────────

  | {
      type:
        "subagent.started";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
    }

  | {
      type:
        "subagent.completed";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
      output?: string;
    }

  | {
      type:
        "subagent.failed";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
      error: string;
    };

export interface AgentEventSink {
  emit(
    event: AgentEvent,
  ):
    | void
    | Promise<void>;
}

type EventListener = (
  event: AgentEvent,
) => void;

interface Subscriber {
  listener: EventListener;
}

export class EventHub
  implements AgentEventSink
{
  private readonly subscribers =
    new Map<
      string,
      Set<Subscriber>
    >();

  async emit(
    event: AgentEvent,
  ): Promise<void> {
    console.log(
      "[EVENT HUB] Emit:",
      {
        type:
          event.type,

        channelId:
          event.context.channelId,

        runId:
          event.context.runId,
      },
    );

    const channelId =
      event.context.channelId;

    if (!channelId) {
      console.log(
        "[EVENT HUB] Emit ignored: no channelId",
      );

      return;
    }

    const subscribers =
      this.subscribers.get(
        channelId,
      );

    console.log(
      "[EVENT HUB] Subscribers:",
      {
        channelId,
        count:
          subscribers?.size ?? 0,
      },
    );

    if (!subscribers) {
      console.log(
        "[EVENT HUB] Emit ignored: no subscribers",
      );

      return;
    }

    for (const subscriber of subscribers) {
      try {
        subscriber.listener(
          event,
        );
      } catch (error) {
        console.error(
          "[EVENT HUB] Subscriber error:",
          error,
        );
      }
    }
  }

  subscribe(
    channelId: string,
    listener: EventListener,
  ): () => void {
    let subscribers =
      this.subscribers.get(
        channelId,
      );

    if (!subscribers) {
      subscribers =
        new Set();

      this.subscribers.set(
        channelId,
        subscribers,
      );
    }

    const subscriber: Subscriber = {
      listener,
    };

    subscribers.add(
      subscriber,
    );

    console.log(
      "[EVENT HUB] Subscriber connected:",
      {
        channelId,
        subscribers:
          subscribers.size,
      },
    );

    let unsubscribed = false;

    return () => {
      if (unsubscribed) {
        return;
      }

      unsubscribed = true;

      subscribers?.delete(
        subscriber,
      );

      if (
        subscribers &&
        subscribers.size === 0
      ) {
        this.subscribers.delete(
          channelId,
        );
      }

      console.log(
        "[EVENT HUB] Subscriber disconnected:",
        {
          channelId,
          subscribers:
            subscribers?.size ?? 0,
        },
      );
    };
  }

  subscriberCount(
    channelId: string,
  ): number {
    return (
      this.subscribers.get(
        channelId,
      )?.size ?? 0
    );
  }
}

export const eventHub =
  new EventHub();