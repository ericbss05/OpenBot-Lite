"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createChannel,
  deleteChannel,
  getChannels,
  updateChannel,
  type Channel,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@/lib/api/channels";

export function useChannels() {
  const [channels, setChannels] = useState<
    Channel[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getChannels();

      setChannels(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load channels",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getChannels();

        if (cancelled) return;

        setChannels(data);
        setError(null);
      } catch (error) {
        if (cancelled) return;

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load channels",
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
  }, []);

  const create = useCallback(
    async (input: CreateChannelInput) => {
      const channel =
        await createChannel(input);

      setChannels((current) => [
        channel,
        ...current,
      ]);

      return channel;
    },
    [],
  );

  const update = useCallback(
    async (
      id: string,
      input: UpdateChannelInput,
    ) => {
      const channel =
        await updateChannel(id, input);

      setChannels((current) =>
        current.map((item) =>
          item.id === id
            ? channel
            : item,
        ),
      );

      return channel;
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteChannel(id);

      setChannels((current) =>
        current.filter(
          (item) => item.id !== id,
        ),
      );
    },
    [],
  );

  return {
    channels,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
  };
}
