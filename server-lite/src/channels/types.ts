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
  lastMessageAt: Date | null;
  createdAt: Date;
};

export type ChannelMessageRole =
  | "user"
  | "assistant"
  | "system";

export type ChannelMessageInteraction = {
  id: string;
  runId: string;
  toolCallId: string;
  type:
    | "clarification"
    | "ask_user";
  question: string;
  options:
    | Array<{
        label: string;
        value: string;
      }>
    | null;
  status:
    | "pending"
    | "answered"
    | "cancelled";
  answer: string | null;
  createdAt: Date;
  answeredAt: Date | null;
};

export type ChannelMessageApproval = {
  id: string;
  runId: string;
  toolCallId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  actorId: string;
  status:
    | "pending"
    | "approved"
    | "rejected";
  createdAt: Date;
  decidedAt: Date | null;
};

export type ChannelMessage = {
  id: string;

  channelId: string;

  role: ChannelMessageRole;

  content: string;

  agentId: string | null;

  interactionId: string | null;

  approvalId: string | null;

  interaction:
    | ChannelMessageInteraction
    | null;

  approval:
    | ChannelMessageApproval
    | null;

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