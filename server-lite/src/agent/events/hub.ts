import type {
  AgentEvent,
  AgentEventSink,
} from "./events";

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
      type: event.type,
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
      subscriber.listener(event);
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
      subscribers = new Set();

      this.subscribers.set(
        channelId,
        subscribers,
      );
    }

    const subscriber: Subscriber = {
      listener,
    };

    subscribers.add(subscriber);

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