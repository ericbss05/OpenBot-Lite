/**
 * 📁 Emplacement : app/agents/_components/agentsEmptyState.tsx
 * 📄 Spécifique à la page /agents — ne pas importer depuis ailleurs.
 */

import Link from "next/link";

import { AgentAvatar } from "@/components/agents/agentAvatar";
import { EmptyState } from "@/components/shared/emptyState";
import { Button } from "@/components/ui/button";

export function AgentsEmptyState() {
  return (
    <EmptyState
      title="Create your first agent"
      description="Build an AI agent that can understand instructions, use tools and execute tasks for you."
      media={
        <div className="relative">
          <AgentAvatar
            agentId="empty-agent"
            palette={0}
            reversed={false}
            size={96}
          />
          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background bg-primary text-sm text-primary-foreground">
            +
          </div>
        </div>
      }
      action={
        <Button>
          <Link href="/agents/new">Create agent</Link>
        </Button>
      }
    />
  );
}