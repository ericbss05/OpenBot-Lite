/**
 * 📁 Emplacement : app/agents/_components/agentsList.tsx
 * 📄 Spécifique à la page /agents — ne pas importer depuis ailleurs.
 */

import { AgentCard } from "@/components/agents/agentCard";
import { CardGrid } from "@/components/shared/cardGrid";
import { CardGridSkeleton } from "@/components/shared/cardGridSkeleton";
import { ErrorState } from "@/components/shared/errorState";
import type { Agent } from "@/lib/api/agents";

import { AgentsEmptyState } from "./agentsEmptyState";

type AgentsListProps = {
  agents: Agent[];
  loading: boolean;
  error: string;
  onRetry: () => void;
};

export function AgentsList({
  agents,
  loading,
  error,
  onRetry,
}: AgentsListProps) {
  if (loading) return <CardGridSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (agents.length === 0) return <AgentsEmptyState />;

  return (
    <CardGrid>
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </CardGrid>
  );
}