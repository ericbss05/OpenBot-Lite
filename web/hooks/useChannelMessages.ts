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
  const [messages, setMessages] = useState<
    ChannelMessage[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (!channelId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getChannelMessages(
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
    if (!channelId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getChannelMessages(
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
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const send = useCallback(
    async (content: string) => {
      const value = content.trim();

      if (!value || sending) return;

      setSending(true);
      setError(null);

      try {
        const result = await sendChannelMessage(
          channelId,
          value,
        );

        await refresh();

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
    [channelId, refresh, sending],
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