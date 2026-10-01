import type { ReactNode } from "react";

import { AgentAvatar } from "@/components/agents/agentAvatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AgentCardViewProps = {
  name: string;
  title?: string;
  description?: string;
  model?: string;
  hasEndpoint?: boolean;
  palette: number;
  reversed: boolean;

  /** Affiche des textes d'exemple quand le nom / la description sont vides. */
  placeholder?: boolean;

  /** Contenu d'action affiché dans le footer. */
  footer?: ReactNode;

  className?: string;
};

export function AgentCardView({
  name,
  title,
  description,
  model,
  hasEndpoint = false,
  palette,
  reversed,
  placeholder = false,
  footer,
  className,
}: AgentCardViewProps) {
  const emptyName = !name && placeholder;

  const displayName =
    name || (emptyName ? "Untitled agent" : "");

  const displayDescription =
    description ||
    (placeholder
      ? "The instructions you write will appear here."
      : "");

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-2xl py-0",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start gap-4 px-5 pt-5">
        <div className="shrink-0 overflow-hidden rounded-xl">
          <AgentAvatar
            agentId="preview"
            palette={palette}
            reversed={reversed}
            size={56}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "truncate text-base font-semibold",
              emptyName && "text-muted-foreground",
            )}
          >
            {displayName}
          </h2>

          {title && (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {title}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        {displayDescription && (
          <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {displayDescription}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Private
          </Badge>

          {model && (
            <Badge variant="secondary">
              {model}
            </Badge>
          )}

          {hasEndpoint && (
            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
              Endpoint
            </Badge>
          )}
        </div>
      </CardContent>

      {footer && (
        <CardFooter
          className={cn(
            "border-t px-4 py-4",
            "flex items-center justify-between gap-4",
          )}
        >
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}