/**
 * 📁 Emplacement : components/shared/infoPanel.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import type { ReactNode } from "react";

type InfoPanelProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function InfoPanel({ title, description, icon }: InfoPanelProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
      {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}

      <div>
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}