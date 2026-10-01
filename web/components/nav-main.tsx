"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AgentAvatar } from "@/components/agents/agentAvatar";
import { cn } from "@/lib/utils";

type Channel = {
  id: string;
  name: string;
  lastMessage?: string;
  updatedAt?: string | number | Date;
  agents: {
    agentId: string;
    role: "primary" | "subagent";
  }[];
};

type Agent = {
  id: string;
  name: string;
  avatarPalette: number;
  avatarReversed: boolean;
};

type NavMainProps = {
  channels?: Channel[];
  agents?: Agent[];
};

export const mockAgents: Agent[] = [
  { id: "knowledge", name: "Knowledge", avatarPalette: 0, avatarReversed: false },
  { id: "metrics", name: "Metrics", avatarPalette: 1, avatarReversed: false },
  { id: "research", name: "Research", avatarPalette: 2, avatarReversed: false },
  { id: "operations", name: "Operations", avatarPalette: 3, avatarReversed: true },
];

export const mockChannels: Channel[] = [
  {
    id: "knowledge",
    name: "Knowledge",
    lastMessage: "cited 3 sources from Drive and OneDrive",
    updatedAt: "2026-10-01T11:08:00",
    agents: [{ agentId: "knowledge", role: "primary" }],
  },
  {
    id: "metrics",
    name: "Metrics",
    lastMessage: "Q3 ticket volume, down 18% quarter over quarter",
    updatedAt: "2026-10-01T10:41:00",
    agents: [{ agentId: "metrics", role: "primary" }],
  },
  {
    id: "research",
    name: "Research",
    lastMessage: "ran /research across 14 sources",
    updatedAt: "2026-10-01T09:12:00",
    agents: [{ agentId: "research", role: "primary" }],
  },
  {
    id: "operations",
    name: "Operations",
    lastMessage: "pulled 52 accounts from the backoffice",
    updatedAt: "2026-10-01T08:30:00",
    agents: [{ agentId: "operations", role: "primary" }],
  },
];

// Valeurs mock utilisées quand un channel n'a pas de lastMessage / updatedAt
const mockMeta = [
  { lastMessage: "cited 3 sources from Drive and OneDrive", updatedAt: "2026-10-01T11:08:00" },
  { lastMessage: "Q3 ticket volume, down 18% quarter over quarter", updatedAt: "2026-10-01T10:41:00" },
  { lastMessage: "ran /research across 14 sources", updatedAt: "2026-10-01T09:12:00" },
  { lastMessage: "pulled 52 accounts from the backoffice", updatedAt: "2026-10-01T08:30:00" },
];

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function NavMain({
  channels = mockChannels,
  agents = mockAgents,
}: NavMainProps) {
  const params = useParams<{ id?: string }>();
  const activeChannelId = params.id;

  function getPrimaryAgent(channel: Channel) {
    const link =
      channel.agents.find((a) => a.role === "primary") ??
      channel.agents[0];

    return link
      ? agents.find((agent) => agent.id === link.agentId)
      : undefined;
  }

  return (
    <ul className="space-y-0.5 px-2">
      {channels.map((channel, index) => {
        const fallback = mockMeta[index % mockMeta.length];
        const lastMessage = channel.lastMessage ?? fallback.lastMessage;
        const updatedAt = channel.updatedAt ?? fallback.updatedAt;
        const agent = getPrimaryAgent(channel);
        const isActive = activeChannelId === channel.id;

        return (
          <li key={channel.id}>
            <Link
              href={`/channels/${channel.id}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                isActive && "bg-white/[0.07]",
              )}
            >
              <div className="size-9 shrink-0 overflow-hidden rounded-full">
                {agent ? (
                  <AgentAvatar
                    agentId="preview"
                    palette={agent.avatarPalette}
                    reversed={agent.avatarReversed}
                    size={36}
                  />
                ) : (
                  <div className="size-full bg-white/10" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {channel.name}
                  </span>
                  {updatedAt && (
                    <span className="shrink-0 text-xs text-white/50">
                      {timeFormatter.format(new Date(updatedAt))}
                    </span>
                  )}
                </div>

                {lastMessage && (
                  <p className="truncate text-xs text-white/50">
                    {lastMessage}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}

      {!channels.length && (
        <li className="px-3 py-6 text-center text-sm text-white/50">
          No channels
        </li>
      )}
    </ul>
  );
}