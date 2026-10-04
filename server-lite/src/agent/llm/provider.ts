import type { Agent } from "../agent";

import type { ToolDefinition } from "../tools/tools";

export interface LLMMessage {
  role:
    | "user"
    | "assistant"
    | "tool";

  content: string;

  toolName?: string;

  toolCallId?: string;

  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;

  toolId: string;

  arguments: Record<
    string,
    unknown
  >;
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
  generate(
    request: LLMRequest,
  ): Promise<LLMResponse>;
}