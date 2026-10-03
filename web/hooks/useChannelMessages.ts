"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getChannelMessages,
  sendChannelMessage,
  type ChannelMessage,
} from "@/lib/api/channels";

export function useChannelMessages(
  channelId: string,
) {
  const [messages, setMessages] =
    useState<ChannelMessage[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data =
        await getChannelMessages(
          channelId,
        );

      setMessages(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load messages",
      );
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const data =
          await getChannelMessages(
            channelId,
          );

        if (cancelled) return;

        setMessages(data);
        setError(null);
      } catch (error) {
        if (cancelled) return;

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

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const appendMessage = useCallback(
    (message: ChannelMessage) => {
      setMessages((current) => {
        const alreadyExists =
          current.some(
            (item) =>
              item.id === message.id,
          );

        if (alreadyExists) {
          return current;
        }

        return [
          ...current,
          message,
        ];
      });
    },
    [],
  );

  const send = useCallback(
    async (content: string) => {
      const value = content.trim();

      if (!value) {
        return;
      }

      const optimisticMessage: ChannelMessage = {
        id: `optimistic-${crypto.randomUUID()}`,
        channelId,
        role: "user",
        content: value,
        agentId: null,
        createdAt:
          new Date().toISOString(),
      };

      appendMessage(
        optimisticMessage,
      );

      setError(null);

      try {
        await sendChannelMessage(
          channelId,
          value,
        );
      } catch (error) {
        setMessages((current) =>
          current.filter(
            (message) =>
              message.id !==
              optimisticMessage.id,
          ),
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to send message",
        );

        throw error;
      }
    },
    [appendMessage, channelId],
  );

  return {
    messages,
    loading,
    error,
    send,
    appendMessage,
    reload: load,
  };
}
