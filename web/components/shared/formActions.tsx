/**
 * 📁 Emplacement : components/shared/formActions.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 * (Le conteneur parent décide du fond, des bordures et des marges.)
 */

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FormActionsProps = {
  cancelHref: string;
  submitLabel: string;
  loadingLabel: string;
  loading: boolean;
  submitDisabled?: boolean;
  cancelLabel?: string;
};

export function FormActions({
  cancelHref,
  submitLabel,
  loadingLabel,
  loading,
  submitDisabled = false,
  cancelLabel = "Cancel",
}: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Button
        variant="ghost"
        className={cn(loading && "pointer-events-none opacity-50")}
      >
        <Link href={cancelHref}>{cancelLabel}</Link>
      </Button>

      <Button type="submit" disabled={loading || submitDisabled}>
        {loading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}