import type { Agent } from "../agent";
import type {
  ToolDefinition,
} from "../tools/tools";

export function buildSystemPrompt(
  agent: Agent,
  tools: ToolDefinition[],
): string {
  const sections = [
    `You are ${agent.name}.`,
    agent.instructions.trim(),

    `You are an autonomous AI agent operating inside an application.`,
    `Use available tools when they are necessary to complete the user's request.`,
    `Do not claim that an action was completed unless the corresponding tool execution succeeded.`,
    `Complete the user's request, not just the current conversational step.`,
    `If you ask the user for information, use their answer to continue the original task.`,
    `Do not stop merely because the user answered a clarification or question.`,
    `After receiving the information you need, continue using the available tools until the requested task is completed.`,
    `Only give a final response when the requested task is completed or cannot be completed.`,
  ];

  if (tools.length > 0) {
    sections.push(
      [
        "Available tools:",
        ...tools.map(
          (tool) =>
            `- ${tool.id}: ${tool.description}`,
        ),
      ].join("\n"),
    );
  }

  return sections
    .filter(Boolean)
    .join("\n\n");
}

