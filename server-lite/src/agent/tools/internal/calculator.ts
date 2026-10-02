import type { Tool } from "../tools";

export const calculatorTool: Tool = {
  definition: {
    id: "calculator",
    description:
      "Performs basic arithmetic calculations using two numbers and an operator.",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "The first number.",
        },
        b: {
          type: "number",
          description: "The second number.",
        },
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform.",
        },
      },
      required: ["a", "b", "operation"],
      additionalProperties: false,
    },
    requiresApproval: false,
  },

  async execute(arguments_) {
    const a = arguments_.a;
    const b = arguments_.b;
    const operation = arguments_.operation;

    if (
      typeof a !== "number" ||
      typeof b !== "number"
    ) {
      throw new Error(
        "Calculator requires numeric values for a and b.",
      );
    }

    if (
      typeof operation !== "string"
    ) {
      throw new Error(
        "Calculator requires an operation.",
      );
    }

    switch (operation) {
      case "add":
        return a + b;

      case "subtract":
        return a - b;

      case "multiply":
  return {
    result: a * b,
    source: "calculator-tool",
  };

      case "divide":
        if (b === 0) {
          throw new Error(
            "Cannot divide by zero.",
          );
        }

        return a / b;

      default:
        throw new Error(
          `Unsupported calculator operation: ${operation}`,
        );
    }
  },
};
