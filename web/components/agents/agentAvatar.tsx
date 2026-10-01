"use client";

import Avatar from "boring-avatars";

import { getAvatarColors } from "@/lib/avatars";

type AgentAvatarProps = {
  agentId: string;
  palette: number;
  reversed: boolean;
  size?: number;
};

export function AgentAvatar({
  agentId,
  palette,
  reversed,
  size = 48,
}: AgentAvatarProps) {
  return (
    <Avatar
      name={agentId}
      variant="marble"
      colors={getAvatarColors(
        palette,
        reversed,
      )}
      size={size}
    />
  );
}