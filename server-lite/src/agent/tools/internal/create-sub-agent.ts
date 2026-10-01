import type { Tool } from "../tools";

export const createSubAgentTool: Tool = {
  definition: {
    id: "create_sub_agent",
    description:
      "Crée un nouvel agent spécialisé.",
    requiresApproval: true,
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nom du nouvel agent",
        },
        role: {
          type: "string",
          description: "Rôle du nouvel agent",
        },
      },
      required: ["name", "role"],
      additionalProperties: false,
    },
  },

  execute: async (arguments_) => ({
    created: true,
    agent: {
      id: `agent_${crypto.randomUUID()}`,
      name: String(arguments_.name ?? ""),
      role: String(arguments_.role ?? ""),
    },
  }),
};