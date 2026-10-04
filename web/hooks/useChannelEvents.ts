"use client";

import { useEffect, useState } from "react";

import { API_URL } from "@/lib/api/client";
import type {
  ChannelMessage,
  UserInteraction,
} from "@/lib/api/channels";
import type { Approval } from "@/lib/api/approvals";

export type ChannelEvent = {
  type: string;
  [key: string]: unknown;
};

type UseChannelEventsOptions = {
  onMessageCreated?: (message: ChannelMessage) => void;
  onApprovalRequired?: (approval: Approval) => void;
  onApprovalResolved?: (approvalId: string) => void;
  onUserInteractionRequired?: (
    interaction: UserInteraction,
    runId: string,
  ) => void;
};

const RUNTIME_EVENTS = [
  "message.created",
  "message.updated",
  "run.started",
  "run.completed",
  "run.failed",
  "llm.started",
  "llm.completed",
  "tool.started",
  "tool.completed",
  "approval.required",
  "approval.approved",
  "approval.rejected",
  "user_interaction.required",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "subagent.started",
  "subagent.completed",
  "subagent.failed",
];

export function useChannelEvents(
  channelId: string,
  options?: UseChannelEventsOptions,
) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ChannelEvent[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const onMessageCreated = options?.onMessageCreated;
  const onApprovalRequired = options?.onApprovalRequired;
  const onApprovalResolved = options?.onApprovalResolved;
  const onUserInteractionRequired =
    options?.onUserInteractionRequired;

  useEffect(() => {
    if (!channelId) return;

    const url =
      `${API_URL}/api/channels/${channelId}/events`;

    console.log("[SSE] Opening:", url);

    const source = new EventSource(url, {
      withCredentials: true,
    });

    const handleConnected = (
      event: MessageEvent,
    ) => {
      console.log(
        "[SSE] Connected:",
        event.data,
      );

      setConnected(true);
      setError(null);
    };

    const handlePing = (
      event: MessageEvent,
    ) => {
      console.log(
        "[SSE] Ping:",
        event.data,
      );
    };

    const handleRuntimeEvent = (
      event: MessageEvent,
    ) => {
      try {
        const data = JSON.parse(event.data);

        const channelEvent: ChannelEvent = {
          type: event.type,
          ...data,
        };

        console.log(
          "[SSE] Event:",
          channelEvent,
        );

        setEvents((current) => [
          ...current,
          channelEvent,
        ]);

        switch (event.type) {
          case "run.started":
            setRuntimeStatus(
              "L'agent démarre...",
            );
            break;

          case "llm.started":
            setRuntimeStatus(
              "L'agent réfléchit...",
            );
            break;

          case "tool.started":
            setRuntimeStatus(
              "Exécution d'un outil...",
            );
            break;

          case "approval.required": {
            const approval: Approval = {
              id: data.approvalId,
              runId:
                data.context?.runId ?? "",
              toolCallId:
                data.toolCallId,
              toolId:
                data.toolId,
              arguments:
                data.arguments ?? {},
              actorId:
                data.context?.actorId ?? "",
              status: "pending",
            };

            console.log(
              "[SSE] Approval required:",
              approval,
            );

            onApprovalRequired?.(
              approval,
            );

            setRuntimeStatus(null);
            break;
          }

          case "approval.approved":
          case "approval.rejected": {
            const approvalId =
              data.approvalId;

            if (approvalId) {
              onApprovalResolved?.(
                approvalId,
              );
            }

            setRuntimeStatus(null);
            break;
          }

          case "user_interaction.required": {
            const interaction =
              data.interaction as
                | UserInteraction
                | undefined;

            const runId =
              data.context?.runId;

            if (
              interaction &&
              runId
            ) {
              console.log(
                "[SSE] User interaction required:",
                {
                  interaction,
                  runId,
                },
              );

              onUserInteractionRequired?.(
                interaction,
                runId,
              );
            }

            setRuntimeStatus(null);
            break;
          }

          case "agent.started":
            setRuntimeStatus(
              "L'agent travaille...",
            );
            break;

          case "subagent.started":
            setRuntimeStatus(
              "Un sous-agent travaille...",
            );
            break;

          case "message.created": {
            const message =
              data.message as
                | ChannelMessage
                | undefined;

            if (message) {
              onMessageCreated?.(
                message,
              );

              if (
                message.role ===
                "assistant"
              ) {
                setRuntimeStatus(null);
              }
            }

            break;
          }

          case "run.completed":
          case "run.failed":
          case "agent.completed":
          case "agent.failed":
          case "subagent.completed":
          case "subagent.failed":
            setRuntimeStatus(null);
            break;

          default:
            break;
        }
      } catch (error) {
        console.error(
          "[SSE] Invalid event:",
          error,
          event.data,
        );
      }
    };

    source.addEventListener(
      "connected",
      handleConnected,
    );

    source.addEventListener(
      "ping",
      handlePing,
    );

    for (
      const eventType of RUNTIME_EVENTS
    ) {
      source.addEventListener(
        eventType,
        handleRuntimeEvent,
      );
    }

    source.onerror = (event) => {
      console.warn(
        "[SSE] Connection lost:",
        event,
      );

      setConnected(false);
    };

    return () => {
      console.log(
        "[SSE] Closing:",
        channelId,
      );

      source.close();
    };
  }, [
    channelId,
    onMessageCreated,
    onApprovalRequired,
    onApprovalResolved,
    onUserInteractionRequired,
  ]);

  return {
    connected,
    events,
    runtimeStatus,
    error,
  };
}