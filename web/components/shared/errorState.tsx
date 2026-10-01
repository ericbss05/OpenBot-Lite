/**
 * 📁 Emplacement : components/shared/errorState.tsx
 * ♻️ Réutilisable (générique) — aucune notion métier, utilisable sur n'importe quelle page.
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="rounded-2xl p-6">
      <AlertDescription className="flex flex-col items-start gap-4">
        <p>{message}</p>
        {onRetry && (
          <Button type="button" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}