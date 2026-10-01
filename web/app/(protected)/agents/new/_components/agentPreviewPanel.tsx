/**
 * 📁 Emplacement : app/agents/new/_components/agentPreviewPanel.tsx
 * 📄 Spécifique à la page /agents/new — ne pas importer depuis ailleurs.
 * (Aperçu en direct : montre la carte telle qu'elle apparaîtra dans la liste.)
 */

import { AgentCardView } from "@/components/agents/agentCardView";
import type { AgentFormValues } from "@/components/agents/agentFormFields";

type AgentPreviewPanelProps = {
  values: AgentFormValues;
  palette: number;
  reversed: boolean;
};

export function AgentPreviewPanel({
  values,
  palette,
  reversed,
}: AgentPreviewPanelProps) {
  return (
    <aside className="lg:sticky lg:top-10">
      <div className="rounded-2xl border border-dashed bg-muted/40 p-3">
        <AgentCardView
          placeholder
          name={values.name.trim()}
          title={values.title.trim()}
          description={values.roleDescription.trim()}
          hasEndpoint={values.endpoint.trim().length > 0}
          palette={palette}
          reversed={reversed}
          footer={
            <>
              <span className="text-xs text-muted-foreground">Agent</span>
              <span className="text-xs text-muted-foreground">Preview</span>
            </>
          }
        />
      </div>

      <p className="mt-3 px-1 text-xs leading-5 text-muted-foreground">
        This is how your agent will appear in your list.
      </p>
    </aside>
  );
}