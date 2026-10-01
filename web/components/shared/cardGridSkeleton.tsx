/**
 * 📁 Emplacement : components/shared/cardGridSkeleton.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import { CardGrid } from "@/components/shared/cardGrid";
import { Skeleton } from "@/components/ui/skeleton";

type CardGridSkeletonProps = {
  count?: number;
  itemClassName?: string;
};

export function CardGridSkeleton({
  count = 6,
  itemClassName = "h-48 rounded-2xl",
}: CardGridSkeletonProps) {
  return (
    <CardGrid>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={itemClassName} />
      ))}
    </CardGrid>
  );
}