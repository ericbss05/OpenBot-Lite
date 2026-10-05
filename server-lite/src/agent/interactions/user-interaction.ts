import type {
  LLMToolCall,
} from "../llm/provider";

import type {
  ToolDefinition,
} from "../tools/tools";

export const USER_INTERACTION_TOOL_ID =
  "user_interaction";

export type UserInteractionType =
  | "clarification"
  | "ask_user";

export interface UserInteractionOption {
  label: string;
  value: string;
}

export interface UserInteraction {
  type: UserInteractionType;
  question: string;
  options?: UserInteractionOption[];
}

export interface PendingUserInteraction {
  toolCallId: string;
  interaction: UserInteraction;
}

export const USER_INTERACTION_TOOL_DEFINITION: ToolDefinition =
  {
    id: USER_INTERACTION_TOOL_ID,

    description:
      "Ask the user a question during the agent run. Use type 'clarification' when you need information that is necessary to continue correctly. Use type 'ask_user' when you intentionally want the user to answer a question or make a decision. Provide options when the user should choose from predefined choices. Omit options when the user should answer freely.",

    inputSchema: {
      type: "object",

      properties: {
        type: {
          type: "string",
          enum: [
            "clarification",
            "ask_user",
          ],
        },

        question: {
          type: "string",
        },

        options: {
          type: "array",

          items: {
            type: "object",

            properties: {
              label: {
                type: "string",
              },

              value: {
                type: "string",
              },
            },

            required: [
              "label",
              "value",
            ],
          },
        },
      },

      required: [
        "type",
        "question",
      ],
    },
  };

export function isUserInteractionToolCall(
  call: LLMToolCall,
): boolean {
  const isInteraction =
    call.toolId ===
    USER_INTERACTION_TOOL_ID;

  if (isInteraction) {
    console.log(
      "[USER INTERACTION] Tool call detected",
      {
        toolCallId: call.id,
        toolId: call.toolId,
        arguments: call.arguments,
      },
    );
  }

  return isInteraction;
}

export function parseUserInteraction(
  call: LLMToolCall,
): UserInteraction {
  console.log(
    "[USER INTERACTION] Parsing interaction",
    {
      toolCallId: call.id,
      arguments: call.arguments,
    },
  );

  if (
    call.toolId !==
    USER_INTERACTION_TOOL_ID
  ) {
    console.error(
      "[USER INTERACTION] Invalid tool call",
      {
        toolId: call.toolId,
      },
    );

    throw new Error(
      `Not a user interaction tool call: ${call.toolId}`,
    );
  }

  const type =
    call.arguments.type;

  if (
    type !== "clarification" &&
    type !== "ask_user"
  ) {
    console.error(
      "[USER INTERACTION] Invalid interaction type",
      {
        type,
      },
    );

    throw new Error(
      "Invalid user interaction type.",
    );
  }

  const question =
    call.arguments.question;

  if (
    typeof question !==
      "string" ||
    question.trim().length === 0
  ) {
    console.error(
      "[USER INTERACTION] Invalid question",
      {
        question,
      },
    );

    throw new Error(
      "User interaction question must be a non-empty string.",
    );
  }

  const rawOptions =
    call.arguments.options;

  let options:
    | UserInteractionOption[]
    | undefined;

  if (
    rawOptions !== undefined
  ) {
    if (
      !Array.isArray(
        rawOptions,
      )
    ) {
      console.error(
        "[USER INTERACTION] Invalid options",
        {
          options: rawOptions,
        },
      );

      throw new Error(
        "User interaction options must be an array.",
      );
    }

    options = rawOptions.map(
      (option, index) => {
        if (
          typeof option !==
            "object" ||
          option === null
        ) {
          console.error(
            "[USER INTERACTION] Invalid option",
            {
              index,
              option,
            },
          );

          throw new Error(
            `Invalid user interaction option at index ${index}.`,
          );
        }

        const candidate =
          option as Record<
            string,
            unknown
          >;

        if (
          typeof candidate.label !==
            "string" ||
          candidate.label.trim()
            .length === 0
        ) {
          console.error(
            "[USER INTERACTION] Invalid option label",
            {
              index,
              label:
                candidate.label,
            },
          );

          throw new Error(
            `User interaction option ${index} has an invalid label.`,
          );
        }

        if (
          typeof candidate.value !==
            "string" ||
          candidate.value.trim()
            .length === 0
        ) {
          console.error(
            "[USER INTERACTION] Invalid option value",
            {
              index,
              value:
                candidate.value,
            },
          );

          throw new Error(
            `User interaction option ${index} has an invalid value.`,
          );
        }

        return {
          label:
            candidate.label,
          value:
            candidate.value,
        };
      },
    );

    if (
      options.length === 0
    ) {
      console.error(
        "[USER INTERACTION] Empty options array",
      );

      throw new Error(
        "User interaction options cannot be empty.",
      );
    }
  }

  const interaction: UserInteraction = {
    type,
    question:
      question.trim(),
    options,
  };

  console.log(
    "[USER INTERACTION] Interaction parsed",
    {
      toolCallId: call.id,
      type: interaction.type,
      question:
        interaction.question,
      options:
        interaction.options,
    },
  );

  return interaction;
}

export function validateUserInteractionAnswer(
  interaction: UserInteraction,
  answer: string,
): string {
  console.log(
    "[USER INTERACTION] Validating answer",
    {
      type: interaction.type,
      question:
        interaction.question,
      answer,
      options:
        interaction.options,
    },
  );

  const normalized =
    answer.trim();

  if (!normalized) {
    console.error(
      "[USER INTERACTION] Empty answer rejected",
    );

    throw new Error(
      "User interaction answer cannot be empty.",
    );
  }

  if (
    interaction.options &&
    interaction.options.length > 0
  ) {
    const valid =
      interaction.options.some(
        (option) =>
          option.value ===
          normalized,
      );

    if (!valid) {
      console.error(
        "[USER INTERACTION] Invalid option answer",
        {
          answer: normalized,
          allowedValues:
            interaction.options.map(
              (option) =>
                option.value,
            ),
        },
      );

      throw new Error(
        "Answer is not one of the available user interaction options.",
      );
    }
  }

  console.log(
    "[USER INTERACTION] Answer validated",
    {
      answer: normalized,
    },
  );

  return normalized;
}