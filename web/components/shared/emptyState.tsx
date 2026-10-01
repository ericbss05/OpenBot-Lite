/**
 * 📁 Emplacement : components/shared/emptyState.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description?: string;
  media?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  media,
  action,
}: EmptyStateProps) {
  return (
    <Card className="min-h-[420px] justify-center rounded-2xl">
      <CardContent className="flex flex-col items-center px-6 py-10 text-center">
        {media}

        <h2 className="mt-7 text-xl font-semibold tracking-tight">{title}</h2>

        {description && (
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}

        {action && <div className="mt-6">{action}</div>}
      </CardContent>
    </Card>
  );
}