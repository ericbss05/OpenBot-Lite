"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getChannel,
  type Channel,
} from "@/lib/api/channels";

export function useChannelDetail(
  channelId: string,
) {
  const [channel, setChannel] =
    useState<Channel | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data =
          await getChannel(channelId);

        if (cancelled) return;

        setChannel(data);
      } catch (error) {
        if (cancelled) return;

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load channel",
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

  return {
    channel,
    loading,
    error,
  };
}
