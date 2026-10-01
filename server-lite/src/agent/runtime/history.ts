import type {
  LLMMessage,
  LLMToolCall,
} from "../llm/provider";

export class RuntimeHistory {
  constructor(
    private readonly messages: LLMMessage[],
  ) {}

  getMessages(): LLMMessage[] {
    return this.messages;
  }

  addUserMessage(content: string): void {
    this.messages.push({
      role: "user",
      content,
    });
  }

  addAssistantToolCalls(
    calls: LLMToolCall[],
  ): void {
    this.messages.push({
      role: "assistant",
      content: "",
      toolCalls: calls,
    });
  }

  addAssistantMessage(
    content: string,
  ): void {
    this.messages.push({
      role: "assistant",
      content,
    });
  }

  addToolResult(
    toolCallId: string,
    result: unknown,
  ): void {
    this.messages.push({
      role: "tool",
      toolCallId,
      content: this.serialize(result),
    });
  }

  private serialize(value: unknown): string {
    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}