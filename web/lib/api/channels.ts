import { apiRequest } from "@/lib/api/client";

export type ChannelAgentRole =
  | "primary"
  | "subagent";

export type ChannelAgent = {
  agentId: string;
  role: ChannelAgentRole;
};

export type Channel = {
  id: string;
  userId: string;
  name: string;
  threadId: string;
  agents: ChannelAgent[];
  active: boolean;
  lastMessageAt: string | null;
  createdAt: string;
};

export type ChannelMessageRole =
  | "user"
  | "assistant"
  | "system";

export type ChannelMessage = {
  id: string;
  channelId: string;
  role: ChannelMessageRole;
  content: string;
  agentId: string | null;
  createdAt: string;
};

export type CreateChannelInput = {
  name: string;
  agents: ChannelAgent[];
};

export type UpdateChannelInput = {
  name?: string;
  active?: boolean;
  agents?: ChannelAgent[];
};

export type SendChannelMessageResponse = {
  queued: boolean;
  channelId: string;
  agentId: string;
};

export async function getChannels(): Promise<
  Channel[]
> {
  return apiRequest<Channel[]>(
    "/api/channels",
  );
}

export async function getChannel(
  id: string,
): Promise<Channel> {
  return apiRequest<Channel>(
    `/api/channels/${id}`,
  );
}

export async function createChannel(
  input: CreateChannelInput,
): Promise<Channel> {
  return apiRequest<Channel>(
    "/api/channels",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateChannel(
  id: string,
  input: UpdateChannelInput,
): Promise<Channel> {
  return apiRequest<Channel>(
    `/api/channels/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteChannel(
  id: string,
): Promise<{ success: boolean }> {
  return apiRequest<{
    success: boolean;
  }>(
    `/api/channels/${id}`,
    {
      method: "DELETE",
    },
  );
}

export async function getChannelMessages(
  id: string,
): Promise<ChannelMessage[]> {
  return apiRequest<ChannelMessage[]>(
    `/api/channels/${id}/messages`,
  );
}

export async function sendChannelMessage(
  id: string,
  content: string,
): Promise<SendChannelMessageResponse> {
  return apiRequest<SendChannelMessageResponse>(
    `/api/channels/${id}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content,
      }),
    },
  );
}