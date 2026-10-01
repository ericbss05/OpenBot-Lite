"use client";

/**
 * 📁 Emplacement : hooks/useAgents.ts
 * ♻️ Réutilisable (domaine agents) — dépend du type Agent, utilisable sur plusieurs pages. (Hook de récupération des agents)
 */

import { useCallback, useEffect, useState } from "react";

import { getAgents, type Agent } from "@/lib/api/agents";

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAgents() {
      try {
        const data = await getAgents();
        if (!cancelled) setAgents(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load agents.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAgents();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  }, []);

  return { agents, loading, error, retry };
}