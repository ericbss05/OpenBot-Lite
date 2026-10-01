/**
 * 📁 Emplacement : components/agents/avatarPicker.tsx
 * ♻️ Réutilisable (domaine agents) — dépend du type Agent, utilisable sur plusieurs pages.
 */

import { AgentAvatar } from "@/components/agents/agentAvatar";
import { Button } from "@/components/ui/button";

type AvatarPickerProps = {
  palette: number;
  reversed: boolean;
  onShuffle: () => void;
  disabled?: boolean;
};

export function AvatarPicker({
  palette,
  reversed,
  onShuffle,
  disabled,
}: AvatarPickerProps) {
  return (
    <div className="flex items-center gap-5">
      <div className="shrink-0 overflow-hidden rounded-2xl">
        <AgentAvatar
          agentId="preview"
          palette={palette}
          reversed={reversed}
          size={80}
        />
      </div>

      <div className="min-w-0">
        <div className="text-sm font-medium">Avatar</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Choose an avatar for your agent.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onShuffle}
          disabled={disabled}
        >
          ↻ Shuffle avatar
        </Button>
      </div>
    </div>
  );
}