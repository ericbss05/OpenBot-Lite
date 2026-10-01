/**
 * 📁 Emplacement : components/agents/agentCard.tsx
 * ♻️ Réutilisable (domaine agents) — dépend du type Agent, utilisable sur plusieurs pages.
 * Carte cliquable : lien + rendu visuel AgentCardView.
 */

import Link from "next/link";

import { AgentCardView } from "@/components/agents/agentCardView";
import type { Agent } from "@/lib/api/agents";

type AgentCardProps = {
  agent: Agent;
};

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group block"
    >
      <AgentCardView
        name={agent.name}
        title={agent.title ?? undefined}
        description={agent.roleDescription ?? undefined}
        model={agent.model}
        hasEndpoint={Boolean(agent.endpoint)}
        palette={agent.avatarPalette}
        reversed={agent.avatarReversed}
        className="h-full transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
        footer={
          <>
            <span className="text-xs text-muted-foreground">
              Agent
            </span>

            <span className="text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
              Open →
            </span>
          </>
        }
      />
    </Link>
  );
}