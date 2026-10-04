import type {
  LLMProvider,
} from "./provider";

import {
  OpenAIProvider,
} from "./providers/openai";

import {
  AnthropicProvider,
} from "./providers/anthropic";

import {
  XAIProvider,
} from "./providers/xai";

export type LLMProviderId =
  | "openai"
  | "anthropic"
  | "xai";

export function createLLMProvider(
  providerId: LLMProviderId,
): LLMProvider {
  switch (providerId) {
    case "openai":
      return new OpenAIProvider();

    case "anthropic":
      return new AnthropicProvider();

    case "xai":
      return new XAIProvider();

    default:
      throw new Error(
        `Unsupported LLM provider: ${providerId}`,
      );
  }
}