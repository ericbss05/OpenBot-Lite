import {
  generateText,
  jsonSchema,
} from "ai";

import {
  createAnthropic,
} from "@ai-sdk/anthropic";

import type {
  LLMMessage,
  LLMProvider,
  LLMRequest,
  LLMResponse,
} from "../provider";

import type {
  ToolDefinition,
} from "../../tools/tools";

import {
  USER_INTERACTION_TOOL_DEFINITION,
} from "../user-interaction";

export class AnthropicProvider
  implements LLMProvider
{
  private readonly provider;

  constructor(
    apiKey = process.env.ANTHROPIC_API_KEY,
  ) {
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not configured",
      );
    }

    this.provider =
      createAnthropic({
        apiKey,
      });
  }

  async generate(
    request: LLMRequest,
  ): Promise<LLMResponse> {
    const response =
      await generateText({
        model: this.provider(
          request.agent.model,
        ),

        system:
          request.agent.instructions,

        messages:
          request.messages.map(
            toAIMessage,
          ),

        tools:
          toAISDKTools(
            request.tools,
          ),
      });

    if (
      response.toolCalls.length >
      0
    ) {
      return {
        type: "tool_calls",

        calls:
          response.toolCalls.map(
            (call) => ({
              id: call.toolCallId,

              toolId:
                call.toolName,

              arguments:
                call.input as Record<
                  string,
                  unknown
                >,
            }),
          ),
      };
    }

    return {
      type: "text",
      content:
        response.text,
    };
  }
}

function toAISDKTools(
  tools: ToolDefinition[],
) {
  const definitions = [
    ...tools,
    USER_INTERACTION_TOOL_DEFINITION,
  ];

  return Object.fromEntries(
    definitions.map(
      (tool) => [
        tool.id,
        {
          description:
            tool.description,

          inputSchema:
            jsonSchema(
              tool.inputSchema,
            ),
        },
      ],
    ),
  );
}

function toAIMessage(
  message: LLMMessage,
) {
  if (
    message.role === "tool"
  ) {
    if (
      !message.toolCallId ||
      !message.toolName
    ) {
      throw new Error(
        "Tool message is missing toolCallId or toolName",
      );
    }

    return {
      role: "tool" as const,

      content: [
        {
          type:
            "tool-result" as const,

          toolCallId:
            message.toolCallId,

          toolName:
            message.toolName,

          output: {
            type:
              "text" as const,

            value:
              message.content,
          },
        },
      ],
    };
  }

  if (
    message.role ===
      "assistant" &&
    message.toolCalls &&
    message.toolCalls.length >
      0
  ) {
    return {
      role:
        "assistant" as const,

      content:
        message.toolCalls.map(
          (call) => ({
            type:
              "tool-call" as const,

            toolCallId:
              call.id,

            toolName:
              call.toolId,

            input:
              call.arguments,
          }),
        ),
    };
  }

  return {
    role:
      message.role,

    content:
      message.content,
  };
}