import type {
  Agent,
} from "../agent";

import type {
  LLMMessage,
  LLMToolCall,
} from "../llm/provider";

import type {
  PendingUserInteraction,
} from "../llm/user-interaction";

import type {
  ToolResult,
} from "../tools/tools";

import type {
  RunContext,
} from "../events/events";

export type RuntimeStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface RuntimeState {
  runId: string;

  context: RunContext;

  agent: Agent;

  status: RuntimeStatus;

  messages: LLMMessage[];

  turn: number;

  maxTurns: number;

  pendingApprovalId?: string;

  pendingToolCall?: LLMToolCall;

  pendingInteraction?: PendingUserInteraction;

  toolResults: ToolResult[];

  result?: string;

  error?: string;
}