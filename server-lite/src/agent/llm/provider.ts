import type { Agent } from "../agent";
import type { ToolDefinition } from "../tools/tools";

export interface LLMMessage {
  role: "user" | "assistant" | "tool";
  content: string;

  /**
   * Identifie le tool call auquel ce résultat correspond.
   *
   * Utilisé uniquement pour les messages role="tool".
   */
  toolCallId?: string;

  /**
   * Tools demandés par l'assistant lors de ce message.
   *
   * Présent lorsqu'un message assistant déclenche
   * une ou plusieurs actions.
   */
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  toolId: string;
  arguments: Record<string, unknown>;
}

export type LLMResponse =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "tool_calls";
      calls: LLMToolCall[];
    };

export interface LLMRequest {
  agent: Agent;
  messages: LLMMessage[];
  tools: ToolDefinition[];
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}