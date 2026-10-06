"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { API_URL } from "@/lib/api/client";

import type {
  ChannelMessage,
  UserInteraction,
} from "@/lib/api/channels";

import type {
  Approval,
} from "@/lib/api/approvals";

export type ChannelEvent = {
  type: string;
  [key: string]: unknown;
};

export type ComputerControlMode =
  | "ai"
  | "human_required"
  | "human";

export type HumanControlRequest = {
  runId: string;
  toolCallId: string;
  reason: string;
  message: string;
};

type UseChannelEventsOptions = {
  onMessageCreated?: (
    message: ChannelMessage,
  ) => void;

  onApprovalRequired?: (
    approval: Approval,
  ) => void;

  onApprovalResolved?: (
    approvalId: string,
  ) => void;

  onUserInteractionRequired?: (
    interaction: UserInteraction,
    runId: string,
  ) => void;

  onHumanControlRequired?: (
    request: HumanControlRequest,
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

  "computer.human_control.required",

  "agent.started",
  "agent.completed",
  "agent.failed",
  "agent.limit_reached",

  "subagent.started",
  "subagent.completed",
  "subagent.failed",
];

function isComputerTool(
  data: Record<string, unknown>,
) {
  const toolId =
    typeof data.toolId === "string"
      ? data.toolId
      : "";

  const toolName =
    typeof data.toolName === "string"
      ? data.toolName
      : "";

  const name =
    typeof data.name === "string"
      ? data.name
      : "";

  return [
    toolId,
    toolName,
    name,
  ].some(
    (value) =>
      value === "computer" ||
      value === "computer_use" ||
      value === "computer-use",
  );
}

function getRunId(
  data: Record<string, unknown>,
): string | null {
  const context = data.context;

  if (
    !context ||
    typeof context !== "object"
  ) {
    return null;
  }

  const runId =
    (
      context as {
        runId?: unknown;
      }
    ).runId;

  return typeof runId === "string"
    ? runId
    : null;
}

export function useChannelEvents(
  channelId: string,
  options?: UseChannelEventsOptions,
) {
  const [
    connected,
    setConnected,
  ] = useState(false);

  const [
    events,
    setEvents,
  ] = useState<ChannelEvent[]>([]);

  const [
    runtimeStatus,
    setRuntimeStatus,
  ] = useState<string | null>(
    null,
  );

  const [
    computerActive,
    setComputerActive,
  ] = useState(false);

  const [
    computerControlMode,
    setComputerControlMode,
  ] =
    useState<ComputerControlMode>(
      "ai",
    );

  const [
    humanControlRequest,
    setHumanControlRequest,
  ] =
    useState<
      HumanControlRequest | null
    >(null);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const callbacksRef = useRef<
    UseChannelEventsOptions
  >({});

  /*
   * Les callbacks du composant parent peuvent changer
   * à chaque render.
   *
   * On les synchronise dans un effet afin de ne jamais
   * modifier la ref pendant le render.
   */
  useEffect(() => {
    callbacksRef.current = {
      onMessageCreated:
        options?.onMessageCreated,

      onApprovalRequired:
        options?.onApprovalRequired,

      onApprovalResolved:
        options?.onApprovalResolved,

      onUserInteractionRequired:
        options?.onUserInteractionRequired,

      onHumanControlRequired:
        options?.onHumanControlRequired,
    };
  }, [
    options?.onMessageCreated,
    options?.onApprovalRequired,
    options?.onApprovalResolved,
    options?.onUserInteractionRequired,
    options?.onHumanControlRequired,
  ]);

  /*
   * La connexion SSE dépend UNIQUEMENT du channelId.
   *
   * Les callbacks sont lus depuis callbacksRef.current.
   * Un rerender du Workspace ne provoque donc jamais
   * une fermeture/réouverture de la connexion.
   */
  useEffect(() => {
    if (!channelId) {
      return;
    }

    const url =
      `${API_URL}/api/channels/${channelId}/events`;

    console.log(
      "[SSE] Opening:",
      url,
    );

    const source =
      new EventSource(
        url,
        {
          withCredentials: true,
        },
      );

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
        const data =
          JSON.parse(
            event.data,
          ) as Record<
            string,
            unknown
          >;

        const channelEvent: ChannelEvent =
          {
            type:
              event.type,
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

            setComputerControlMode(
              "ai",
            );

            setHumanControlRequest(
              null,
            );

            break;

          case "llm.started":
            setRuntimeStatus(
              "L'agent réfléchit...",
            );

            break;

          case "tool.started": {
            setRuntimeStatus(
              "Exécution d'un outil...",
            );

            if (
              isComputerTool(data)
            ) {
              console.log(
                "[SSE] Computer tool started:",
                data,
              );

              setComputerActive(
                true,
              );
            }

            break;
          }

          case "tool.completed": {
            if (
              isComputerTool(data)
            ) {
              console.log(
                "[SSE] Computer tool completed:",
                data,
              );

              setComputerActive(
                false,
              );
            }

            break;
          }

          case "computer.human_control.required": {
            const runId =
              getRunId(data);

            const toolCallId =
              typeof data.toolCallId ===
              "string"
                ? data.toolCallId
                : "";

            const reason =
              typeof data.reason ===
              "string"
                ? data.reason
                : "Une intervention humaine est nécessaire.";

            const message =
              typeof data.message ===
              "string"
                ? data.message
                : reason;

            if (
              runId &&
              toolCallId
            ) {
              const request: HumanControlRequest =
                {
                  runId,
                  toolCallId,
                  reason,
                  message,
                };

              console.log(
                "[SSE] Human control required:",
                request,
              );

              setComputerActive(
                false,
              );

              setComputerControlMode(
                "human_required",
              );

              setHumanControlRequest(
                request,
              );

              setRuntimeStatus(
                "Intervention humaine requise",
              );

              callbacksRef.current
                .onHumanControlRequired?.(
                  request,
                );

              /*
               * Affiche également la demande
               * d'intervention directement dans
               * la conversation.
               */
              callbacksRef.current
                .onMessageCreated?.({
                  id:
                    `human-control-${runId}-${toolCallId}`,

                  role:
                    "assistant",

                  content:
                    message,
                } as ChannelMessage);
            }

            break;
          }

          /*
           * Le runtime a atteint sa limite de turns.
           *
           * Ce n'est pas une erreur technique :
           * le run s'arrête proprement et demande
           * à l'utilisateur s'il souhaite réessayer.
           */
          case "agent.limit_reached": {
            const runId =
              getRunId(data);

            const maxTurns =
              typeof data.maxTurns ===
              "number"
                ? data.maxTurns
                : null;

            console.log(
              "[SSE] Agent turn limit reached:",
              {
                runId,
                maxTurns,
              },
            );

            setComputerActive(
              false,
            );

            setComputerControlMode(
              "ai",
            );

            setHumanControlRequest(
              null,
            );

            setRuntimeStatus(
              "L'agent a atteint sa limite d'exécution.",
            );

            /*
             * Message visible dans le chat.
             *
             * On ne montre volontairement
             * pas "Maximum turns exceeded"
             * à l'utilisateur.
             */
            callbacksRef.current
              .onMessageCreated?.({
                id:
                  `agent-limit-${runId ?? Date.now()}`,

                role:
                  "assistant",

                content:
                  "J'ai rencontré une difficulté en cours d'exécution et je n'ai pas pu terminer la tâche. Voulez-vous que je réessaie ?",
              } as ChannelMessage);

            break;
          }

          case "approval.required": {
            const context =
              data.context;

            const approval: Approval =
              {
                id:
                  typeof data.approvalId ===
                  "string"
                    ? data.approvalId
                    : "",

                runId:
                  context &&
                  typeof context ===
                    "object" &&
                  typeof (
                    context as {
                      runId?: unknown;
                    }
                  ).runId ===
                    "string"
                    ? (
                        context as {
                          runId: string;
                        }
                      ).runId
                    : "",

                toolCallId:
                  typeof data.toolCallId ===
                  "string"
                    ? data.toolCallId
                    : "",

                toolId:
                  typeof data.toolId ===
                  "string"
                    ? data.toolId
                    : "",

                arguments:
                  data.arguments &&
                  typeof data.arguments ===
                    "object"
                    ? (
                        data.arguments as Record<
                          string,
                          unknown
                        >
                      )
                    : {},

                actorId:
                  context &&
                  typeof context ===
                    "object" &&
                  typeof (
                    context as {
                      actorId?: unknown;
                    }
                  ).actorId ===
                    "string"
                    ? (
                        context as {
                          actorId: string;
                        }
                      ).actorId
                    : "",

                status:
                  "pending",
              };

            console.log(
              "[SSE] Approval required:",
              approval,
            );

            callbacksRef.current
              .onApprovalRequired?.(
                approval,
              );

            setRuntimeStatus(
              null,
            );

            break;
          }

          case "approval.approved":
          case "approval.rejected": {
            const approvalId =
              typeof data.approvalId ===
              "string"
                ? data.approvalId
                : null;

            if (
              approvalId
            ) {
              callbacksRef.current
                .onApprovalResolved?.(
                  approvalId,
                );
            }

            setRuntimeStatus(
              null,
            );

            break;
          }

          case "user_interaction.required": {
            const interaction =
              data.interaction as
                | UserInteraction
                | undefined;

            const runId =
              getRunId(data);

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

              callbacksRef.current
                .onUserInteractionRequired?.(
                  interaction,
                  runId,
                );
            }

            setRuntimeStatus(
              null,
            );

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
              console.log(
                "[SSE] Message created:",
                message,
              );

              callbacksRef.current
                .onMessageCreated?.(
                  message,
                );

              if (
                message.role ===
                "assistant"
              ) {
                setRuntimeStatus(
                  null,
                );
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
            setRuntimeStatus(
              null,
            );

            setComputerActive(
              false,
            );

            setComputerControlMode(
              "ai",
            );

            setHumanControlRequest(
              null,
            );

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

        setError(
          "Événement SSE invalide.",
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

    source.onerror = (
      event,
    ) => {
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
  }, [channelId]);

  return {
    connected,
    events,
    runtimeStatus,
    computerActive,
    computerControlMode,
    humanControlRequest,
    error,
  };
}
