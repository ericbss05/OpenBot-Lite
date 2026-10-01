"use client";

/**
 * 📁 Emplacement : app/agents/page.tsx
 * 📄 Spécifique à la page /agents — point d'entrée de la route /agents.
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";

import { AgentsList } from "./_components/agentsList";

export default function AgentsPage() {
  const { agents, loading, error, retry } = useAgents();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Your agents
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Create and manage your AI agents.
            </p>
          </div>

          <Button >
            <Link href="/agents/new">
              + Create agent
            </Link>
          </Button>
        </div>

        <div className="mt-8">
          <AgentsList
            agents={agents}
            loading={loading}
            error={error}
            onRetry={retry}
          />
        </div>
      </div>
    </main>
  );
}