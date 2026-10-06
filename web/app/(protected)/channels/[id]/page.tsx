"use client";

import { useParams } from "next/navigation";

import { ChannelWorkspace } from "./_components/channelWorkspace";

export default function ChannelPage() {
  const params =
    useParams<{ id: string }>();

  return (
    <ChannelWorkspace
      channelId={params.id}
    />
  );
}