"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getTool,
  getTools,
  type ToolCatalogItem,
} from "@/lib/api/tools";

export function useTools() {
  const [tools, setTools] = useState<
    ToolCatalogItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getTools();

        if (!cancelled) {
          setTools(result);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load tools.",
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getTools();

      setTools(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load tools.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const findTool = useCallback(
    async (toolId: string) => {
      return getTool(toolId);
    },
    [],
  );

  return {
    tools,
    loading,
    error,
    reload,
    findTool,
  };
}