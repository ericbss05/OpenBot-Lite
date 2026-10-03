import { streamSSE } from "hono/streaming";
import type { Context } from "hono";

import {
  eventHub,
} from "../agent/events/hub";

function serializeEvent(
  event: unknown,
): string {
  return JSON.stringify(event);
}

export async function eventsRoute(
  c: Context,
) {
  const channelId =
    c.req.param("channelId");

  if (!channelId) {
    return c.json(
      {
        error:
          "Channel ID is required.",
      },
      400,
    );
  }

  const response = streamSSE(
    c,
    async (stream) => {
      console.log(
        "[SSE] Opening stream:",
        {
          channelId,
        },
      );

      const unsubscribe =
        eventHub.subscribe(
          channelId,
          (event) => {
            if (stream.aborted) {
              return;
            }

            void stream.writeSSE({
              event: event.type,
              data: serializeEvent(
                event,
              ),
            });
          },
        );

      let cleanedUp = false;

      const cleanup = () => {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        unsubscribe();
      };

      stream.onAbort(() => {
        console.log(
          "[SSE] Client disconnected:",
          {
            channelId,
          },
        );

        cleanup();
      });

      try {
        await stream.writeSSE({
          event: "connected",
          data: JSON.stringify({
            channelId,
          }),
        });

        console.log(
          "[SSE] Connected event sent:",
          {
            channelId,
          },
        );

while (!stream.aborted) {
  console.log("[SSE] Waiting:", {
    channelId,
    aborted: stream.aborted,
  });

  await stream.sleep(15_000);

  console.log("[SSE] Woke up:", {
    channelId,
    aborted: stream.aborted,
  });

  if (stream.aborted) {
    console.log("[SSE] Stream aborted before ping:", {
      channelId,
    });

    break;
  }

  await stream.writeSSE({
    event: "ping",
    data: JSON.stringify({
      channelId,
    }),
  });

  console.log("[SSE] Ping sent:", {
    channelId,
  });
}
      } catch (error) {
        console.error(
          "[SSE] Stream error:",
          {
            channelId,
            error,
          },
        );
      } finally {
        cleanup();

        console.log(
          "[SSE] Stream closed:",
          {
            channelId,
          },
        );
      }
    },
  );

  response.headers.set(
    "Access-Control-Allow-Origin",
    "http://localhost:3000",
  );

  response.headers.set(
    "Access-Control-Allow-Credentials",
    "true",
  );

  return response;
}
