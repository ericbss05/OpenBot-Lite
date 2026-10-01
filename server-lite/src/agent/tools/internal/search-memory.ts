import type { Tool } from "../tools";

export const searchMemoryTool: Tool = {
  definition: {
    id: "search_memory",
    description:
      "Recherche une information dans la mémoire de l'agent.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Information à rechercher",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },

  execute: async (arguments_) => ({
    found: false,
    query: String(arguments_.query ?? ""),
    message:
      "Aucune mémoire trouvée pour le moment.",
  }),
};