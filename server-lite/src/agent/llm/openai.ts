import OpenAI from "openai";

import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "./provider";

import type { ToolDefinition } from "../tools/tools";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.client = new OpenAI({ apiKey });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const tools = request.tools.map(toOpenAITool);

    const input = request.messages.flatMap((message) =>
      toOpenAIMessage(message),
    );

    const response = await this.client.responses.create({
      model: request.agent.model,
      instructions: request.agent.instructions,
      input,
      tools,
    });

    const calls = response.output
      .filter(
        (
          item,
        ): item is Extract<
          (typeof response.output)[number],
          { type: "function_call" }
        > => item.type === "function_call",
      )
      .map((call) => ({
        id: call.call_id,
        toolId: call.name,
        arguments: parseArguments(call.arguments),
      }));

    if (calls.length > 0) {
      return {
        type: "tool_calls",
        calls,
      };
    }

    return {
      type: "text",
      content: response.output_text,
    };
  }
}

function toOpenAITool(tool: ToolDefinition) {
  return {
    type: "function" as const,
    name: tool.id,
    description: tool.description,
    strict: true,
    parameters: tool.inputSchema,
  };
}

function toOpenAIMessage(
  message: LLMMessage,
): OpenAI.Responses.ResponseInputItem[] {
  if (message.role === "tool") {
    return [
      {
        type: "function_call_output",
        call_id: message.toolCallId!,
        output: message.content,
      },
    ];
  }

  if (
    message.role === "assistant" &&
    message.toolCalls &&
    message.toolCalls.length > 0
  ) {
    return message.toolCalls.map((call) => ({
      type: "function_call",
      call_id: call.id,
      name: call.toolId,
      arguments: JSON.stringify(call.arguments),
    }));
  }

  return [
    {
      role: message.role,
      content: message.content,
    },
  ];
}

function parseArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("Tool arguments must be an object");
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON returned for tool arguments");
  }
}