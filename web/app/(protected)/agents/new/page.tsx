/**
 * 📁 Emplacement : app/agents/new/page.tsx
 * 📄 Spécifique à la page /agents/new — point d'entrée de la route /agents/new.
 */

import Link from "next/link";

import { CreateAgentLayout } from "./_components/createAgentLayout";

export default function NewAgentPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/agents"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to agents
        </Link>

        <div className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create agent
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Configure your new AI agent.
          </p>
        </div>

        <div className="mt-8">
          <CreateAgentLayout />
        </div>
      </div>
    </main>
  );
}