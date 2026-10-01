"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Plus, Search, Zap } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { useChannels } from "@/hooks/useChannels";
import { useAgents } from "@/hooks/useAgents";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const user = {
  name: "User",
  email: "",
  avatar: "",
};

const footerLinks = [
  { href: "/skills", label: "Skills", icon: Box },
  { href: "/agents", label: "Agents", icon: Zap },
];

export function AppSidebar(
  props: React.ComponentProps<typeof Sidebar>,
) {
  const pathname = usePathname();

  const { channels, loading: channelsLoading } = useChannels();
  const { agents, loading: agentsLoading } = useAgents();

  const [search, setSearch] = React.useState("");

  const filteredChannels = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return channels;
    }

    return channels.filter((channel) =>
      channel.name.toLowerCase().includes(query),
    );
  }, [channels, search]);

  const loading = channelsLoading || agentsLoading;

  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-3 px-3 pt-4">
        <div className="flex items-center justify-between px-2">
          <Link
            href="/channels"
            className="text-lg font-semibold tracking-tight"
          >
            OpenBot
          </Link>

          <Link
            href="/channels/new"
            aria-label="Create channel"
            className="rounded-md p-1 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <Plus className="size-5" strokeWidth={1.75} />
          </Link>
        </div>

        <label className="flex h-10 items-center gap-2.5 rounded-xl border border-sidebar-border bg-black/50 px-3 text-muted-foreground focus-within:border-sidebar-ring">
          <Search className="size-4 shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </SidebarHeader>

      <SidebarContent>
        {!loading && (
          <NavMain channels={filteredChannels} agents={agents} />
        )}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3">
        <SidebarMenu>
          {footerLinks.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                isActive={pathname?.startsWith(href)}
                className="h-10 gap-3 px-3"
                render={<Link href={href} />}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}