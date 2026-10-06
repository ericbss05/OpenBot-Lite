"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getChannelMessages,
  sendChannelMessage,
  type ChannelMessage,
} from "@/lib/api/channels";

const OPTIMISTIC_PREFIX = "optimistic-";

export function useChannelMessages(channelId: string) {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Rechargement complet (affiche l'état "loading"). */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getChannelMessages(channelId);

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

  /*
   * Rechargement silencieux : pas de "loading", et les messages
   * optimistes pas encore persistés sont conservés.
   */
  const refresh = useCallback(async () => {
    try {
      const data = await getChannelMessages(channelId);

      setMessages((current) => {
        const pendingOptimistic = current.filter(
          (message) =>
            message.id.startsWith(OPTIMISTIC_PREFIX) &&
            !data.some(
              (persisted) =>
                persisted.role === message.role &&
                persisted.content === message.content,
            ),
        );

        return [...data, ...pendingOptimistic];
      });
    } catch {
      // Silencieux : l'état actuel reste affiché.
    }
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        const data = await getChannelMessages(channelId);

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

  /*
   * Ajoute un message, ou met à jour celui qui existe déjà (même id).
   * Important : un message peut arriver une première fois sans son
   * interaction / approval, puis une seconde fois avec.
   */
  const appendMessage = useCallback((message: ChannelMessage) => {
    setMessages((current) => {
      const exists = current.some((item) => item.id === message.id);

      if (!exists) {
        return [...current, message];
      }

      return current.map((item) =>
        item.id === message.id ? { ...item, ...message } : item,
      );
    });
  }, []);

  const send = useCallback(
    async (content: string) => {
      const value = content.trim();

      if (!value) {
        return;
      }

      const optimisticMessage: ChannelMessage = {
        id: `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`,
        channelId,
        role: "user",
        content: value,
        agentId: null,
        interactionId: null,
        approvalId: null,
        interaction: null,
        approval: null,
        createdAt: new Date().toISOString(),
      };

      appendMessage(optimisticMessage);

      setError(null);

      try {
        await sendChannelMessage(channelId, value);
      } catch (error) {
        setMessages((current) =>
          current.filter(
            (message) => message.id !== optimisticMessage.id,
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
    refresh,
    reload: load,
  };
}