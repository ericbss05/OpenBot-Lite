"use client";

import type { ReactNode } from "react";

type ChannelToolbarProps = {
  children?: ReactNode;
};

export function ChannelToolbar({
  children,
}: ChannelToolbarProps) {
  return (
    <aside className="min-h-0 min-w-0 overflow-hidden border-l bg-background">
      {children}
    </aside>
  );
}