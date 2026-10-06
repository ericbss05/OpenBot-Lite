import {
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type {
  ApprovalStatus,
  ApprovalView,
} from "./types";

type ApprovalCardProps = {
  approval: ApprovalView;
  status: ApprovalStatus;
  processing: boolean;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalCard({
  approval,
  status,
  processing,
  disabled,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const pending =
    status === "pending";

  const title = {
    pending:
      "Approbation requise",
    approved:
      "Action autorisée",
    rejected:
      "Action refusée",
    resolved:
      "Action traitée",
  }[status];

  const icon = {
    pending: (
      <ShieldAlert className="size-4 text-amber-500" />
    ),
    approved: (
      <ShieldCheck className="size-4 text-green-500" />
    ),
    rejected: (
      <ShieldX className="size-4 text-destructive" />
    ),
    resolved: (
      <ShieldCheck className="size-4 text-muted-foreground" />
    ),
  }[status];

  return (
    <Card className="flex max-w-[85%] flex-col gap-4 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium">
            {title}
          </p>

          {pending && (
            <p className="mt-1 text-sm text-muted-foreground">
              L&apos;agent souhaite exécuter
              une action nécessitant votre
              autorisation.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted p-3">
        <p className="font-mono text-xs font-medium">
          {approval.toolId}
        </p>

        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
          {JSON.stringify(
            approval.arguments,
            null,
            2,
          )}
        </pre>
      </div>

      {pending && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onReject}
          >
            {processing && (
              <Loader2 className="animate-spin" />
            )}
            Refuser
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={onApprove}
          >
            {processing && (
              <Loader2 className="animate-spin" />
            )}
            Autoriser
          </Button>
        </div>
      )}
    </Card>
  );
}