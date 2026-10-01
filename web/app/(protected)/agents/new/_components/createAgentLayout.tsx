"use client";

/**
 * 📁 Emplacement : app/agents/new/_components/createAgentLayout.tsx
 * 📄 Spécifique à la page /agents/new — ne pas importer depuis ailleurs.
 * (Porte l'état partagé : formulaire à gauche, aperçu en direct à droite.)
 */

import { AgentPreviewPanel } from "./agentPreviewPanel";
import { CreateAgentForm } from "./createAgentForm";
import { useCreateAgent } from "@/hooks/useCreateAgent";

export function CreateAgentLayout() {
  const state = useCreateAgent();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <CreateAgentForm state={state} />

      <AgentPreviewPanel
        values={state.values}
        palette={state.avatar.palette}
        reversed={state.avatar.reversed}
      />
    </div>
  );
}