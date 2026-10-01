export type ChannelAgentRole = "primary" | "subagent";

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
  lastMessageAt: Date | null;
  createdAt: Date;
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
  createdAt: Date;
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

export type SendChannelMessageInput = {
  channelId: string;
  content: string;
};