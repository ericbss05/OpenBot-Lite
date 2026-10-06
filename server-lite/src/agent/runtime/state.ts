
import type {
  Agent,
} from "../agent";

import type {
  LLMMessage,
  LLMToolCall,
} from "../llm/provider";

import type {
  PendingUserInteraction,
} from "../interactions/user-interaction";

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
  | "limit_reached"
  | "cancelled";

export interface PendingHumanControl {
  toolCallId: string;
  reason: string;
  message: string;
}

export interface RuntimeState {
  runId: string;

  context: RunContext;

  agent: Agent;

  status: RuntimeStatus;

  messages: LLMMessage[];

  turn: number;

  maxTurns: number;

  /**
   * Approval currently waiting for a decision.
   */
  pendingApprovalId?: string;

  /**
   * Tool call associated with the pending approval.
   */
  pendingToolCall?: LLMToolCall;

  /**
   * User interaction currently waiting for an answer.
   */
  pendingInteraction?: PendingUserInteraction;

  /**
   * Human intervention currently required.
   *
   * This is used by the computer-use runtime when
   * the agent reaches a step that requires the user
   * to take control of the desktop.
   *
   * Example:
   *
   * - login
   * - MFA
   * - CAPTCHA
   * - biometric validation
   * - private information
   * - native system permission
   */
  pendingHumanControl?: PendingHumanControl;

  /**
   * Results produced by tools during the run.
   */
  toolResults: ToolResult[];

  /**
   * Final agent result.
   */
  result?: string;

  /**
   * Error produced by the runtime.
   */
  error?: string;
}