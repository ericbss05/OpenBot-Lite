import type {
  UserInteraction,
} from "@/lib/api/channels";

import type {
  MessageInteraction,
  InteractionStatus,
} from "./types";

export function toUserInteraction(
  interaction: MessageInteraction,
): UserInteraction {
  return {
    type:
      interaction.type,
    question:
      interaction.question,
    options:
      interaction.options ??
      undefined,
  };
}

export function toInteractionStatus(
  status: string,
): InteractionStatus {
  if (
    status === "answered"
  ) {
    return "answered";
  }

  if (
    status === "cancelled"
  ) {
    return "cancelled";
  }

  return "pending";
}

export function getInteractionAnswer(
  interaction: MessageInteraction,
): string | null {
  const value = (
    interaction as MessageInteraction & {
      answer?: string | null;
    }
  ).answer;

  return value ?? null;
}

export function interactionKey(
  runId: string,
  question: string,
): string {
  return `${runId}::${question}`;
}