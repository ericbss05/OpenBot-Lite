import type { Tool } from "../tools";

export const currentTimeTool: Tool = {
  definition: {
    id: "current_time",
    description:
      "Retourne la date et l'heure actuelle du serveur.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },

  execute: async () => ({
    timestamp: new Date().toISOString(),
  }),
};