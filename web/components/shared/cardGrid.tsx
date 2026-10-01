/**
 * 📁 Emplacement : components/shared/cardGrid.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CardGridProps = {
  children: ReactNode;
  className?: string;
};

export function CardGrid({ children, className }: CardGridProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}