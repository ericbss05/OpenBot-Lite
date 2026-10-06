import { PanelRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChannelHeaderProps = {
  name: string;
  id: string;
  connected: boolean;
  toolbarOpen: boolean;
  onToolbarToggle: () => void;
};

export function ChannelHeader({
  name,
  id,
  connected,
  toolbarOpen,
  onToolbarToggle,
}: ChannelHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-6 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-base font-medium">
          {name}
        </h1>

        <p className="truncate text-xs text-muted-foreground">
          {id}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5 font-normal text-muted-foreground"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              connected
                ? "bg-green-500"
                : "bg-muted-foreground/40",
            )}
          />

          {connected
            ? "Connecté"
            : "Déconnecté"}
        </Badge>

        <Button
          type="button"
          variant={
            toolbarOpen
              ? "secondary"
              : "ghost"
          }
          size="icon"
          onClick={onToolbarToggle}
          aria-label={
            toolbarOpen
              ? "Fermer les outils"
              : "Ouvrir les outils"
          }
          aria-expanded={toolbarOpen}
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
    </header>
  );
}