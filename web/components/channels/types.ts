import type {
  ChannelMessage,
  UserInteraction,
} from "@/lib/api/channels";

type MessageApproval =
  NonNullable<
    ChannelMessage["approval"]
  >;

export type MessageInteraction =
  NonNullable<
    ChannelMessage["interaction"]
  >;

export type ApprovalView =
  Pick<
    MessageApproval,
    | "id"
    | "toolId"
    | "arguments"
  >;

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "resolved";

export type InteractionStatus =
  | "pending"
  | "answered"
  | "cancelled";

export type ActiveInteraction = {
  interaction: UserInteraction;
  runId: string;
};

export type ApprovalDecision = {
  status: ApprovalStatus;
  approval: ApprovalView;
};

export type InteractionInfo = {
  ownerId: string;
  status: InteractionStatus;
  answer: string | null;
};