import type { Tool } from "../tools";

export const textAnalyzerTool: Tool = {
  definition: {
    id: "text_analyzer",
    description:
      "Analyse un texte et retourne quelques statistiques.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Texte à analyser",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },

  execute: async (arguments_) => {
    const text = String(arguments_.text ?? "");

    return {
      characters: text.length,
      words: text.trim()
        ? text.trim().split(/\s+/).length
        : 0,
    };
  },
};