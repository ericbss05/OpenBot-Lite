"use client";

/**
 * 📁 Emplacement : app/agents/new/_hooks/useCreateAgent.ts
 * 📄 Spécifique à la page /agents/new — ne pas importer depuis ailleurs. (État du formulaire + soumission + redirection)
 */

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import type { AgentFormValues } from "@/components/agents/agentFormFields";
import { useAvatarShuffle } from "@/hooks/useAvatarShuffle";
import { createAgent } from "@/lib/api/agents";

const INITIAL_VALUES: AgentFormValues = {
  name: "",
  title: "",
  roleDescription: "",
  endpoint: "",
};

export function useCreateAgent() {
  const router = useRouter();
  const avatar = useAvatarShuffle();

  const [values, setValues] = useState<AgentFormValues>(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setField = useCallback(
    <K extends keyof AgentFormValues>(field: K, value: AgentFormValues[K]) => {
      setValues((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const payload = {
      name: values.name.trim(),
      title: values.title.trim() || undefined,
      roleDescription: values.roleDescription.trim() || undefined,
      endpoint: values.endpoint.trim() || undefined,
      visibility: "private" as const,
      avatarPalette: avatar.palette,
      avatarReversed: avatar.reversed,
    };

    try {
      await createAgent(payload);

      router.push("/agents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent.");
    } finally {
      setLoading(false);
    }
  }

  return {
    values,
    setField,
    avatar,
    loading,
    error,
    canSubmit: values.name.trim().length > 0,
    handleSubmit,
  };
}

export type CreateAgentState = ReturnType<typeof useCreateAgent>;