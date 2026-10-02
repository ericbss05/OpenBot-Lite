"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getChannelMessages,
  sendChannelMessage,
  type ChannelMessage,
} from "@/lib/api/channels";

const POLL_INTERVAL_MS = 700;
const MAX_POLL_ATTEMPTS = 30;

export function useChannelMessages(
  channelId: string,
) {
  const [messages, setMessages] =
    useState<ChannelMessage[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const pollingRef =
    useRef(false);

  const refresh =
    useCallback(async () => {
      if (!channelId) {
        return [];
      }

      const data =
        await getChannelMessages(
          channelId,
        );

      setMessages(data);

      return data;
    }, [channelId]);

  // ------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data =
          await getChannelMessages(
            channelId,
          );

        if (cancelled) {
          return;
        }

        setMessages(data);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load messages",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // ------------------------------------------------------------
  // Poll until a new assistant message appears
  // ------------------------------------------------------------

  const waitForAssistantResponse =
    useCallback(
      async (
        previousMessageCount: number,
      ) => {
        if (!channelId) {
          return;
        }

        if (pollingRef.current) {
          return;
        }

        pollingRef.current = true;

        try {
          for (
            let attempt = 0;
            attempt < MAX_POLL_ATTEMPTS;
            attempt += 1
          ) {
            await new Promise<void>(
              (resolve) => {
                setTimeout(
                  resolve,
                  POLL_INTERVAL_MS,
                );
              },
            );

            const data =
              await getChannelMessages(
                channelId,
              );

            setMessages(data);

            /*
             * On attend qu'un nouveau message
             * assistant apparaisse.
             *
             * Le message utilisateur est déjà
             * présent dans l'historique après POST.
             */
            const hasNewMessage =
              data.length >
              previousMessageCount;

            const hasAssistantMessage =
              data
                .slice(previousMessageCount)
                .some(
                  (message) =>
                    message.role ===
                    "assistant",
                );

            if (
              hasNewMessage &&
              hasAssistantMessage
            ) {
              return;
            }
          }
        } finally {
          pollingRef.current = false;
        }
      },
      [channelId],
    );

  // ------------------------------------------------------------
  // Send
  // ------------------------------------------------------------

  const send =
    useCallback(
      async (content: string) => {
        const value =
          content.trim();

        if (
          !value ||
          sending ||
          !channelId
        ) {
          return;
        }

        setSending(true);
        setError(null);

        try {
          /*
           * On récupère le nombre de messages
           * AVANT l'envoi.
           */
          const before =
            await getChannelMessages(
              channelId,
            );

          setMessages(before);

          /*
           * Le backend ajoute immédiatement
           * le message utilisateur puis met
           * le traitement agent dans la queue.
           */
          const result =
            await sendChannelMessage(
              channelId,
              value,
            );

          /*
           * On recharge immédiatement pour
           * afficher le message utilisateur.
           */
          const afterSend =
            await getChannelMessages(
              channelId,
            );

          setMessages(afterSend);

          /*
           * Le worker fonctionne en arrière-plan.
           *
           * On attend donc que sa réponse
           * assistant apparaisse réellement.
           */
          await waitForAssistantResponse(
            afterSend.length,
          );

          return result;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to send message";

          setError(message);

          throw error;
        } finally {
          setSending(false);
        }
      },
      [
        channelId,
        sending,
        waitForAssistantResponse,
      ],
    );

  return {
    messages,
    loading,
    sending,
    error,
    refresh,
    send,
  };
}