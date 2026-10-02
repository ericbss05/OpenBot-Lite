import type { Tool } from "../tools";

export const createSubAgentTool: Tool = {
  definition: {
    id: "create_sub_agent",

    description:
      "Crée un nouvel agent spécialisé avec les outils qui lui sont attribués.",

    requiresApproval: true,

    inputSchema: {
      type: "object",

      properties: {
        name: {
          type: "string",
          description:
            "Nom du nouvel agent",
        },

        role: {
          type: "string",
          description:
            "Rôle du nouvel agent",
        },

        tools: {
          type: "array",
          description:
            "Liste des outils que le nouvel agent est autorisé à utiliser.",
          items: {
            type: "string",
          },
        },
      },

      required: [
        "name",
        "role",
        "tools",
      ],

      additionalProperties: false,
    },
  },

  execute: async (arguments_) => {
    console.log(
      "[SUBAGENT TOOL] CALLED",
    );

    console.log(
      "[SUBAGENT TOOL] arguments:",
      arguments_,
    );

    const name = String(
      arguments_.name ?? "",
    );

    const role = String(
      arguments_.role ?? "",
    );

    const tools = Array.isArray(
      arguments_.tools,
    )
      ? arguments_.tools.filter(
          (tool): tool is string =>
            typeof tool === "string",
        )
      : [];

    const agent = {
      id: `agent_${crypto.randomUUID()}`,
      name,
      role,
      isPrimary: false,
      tools,
    };

    console.log(
      "[SUBAGENT TOOL] created:",
      agent,
    );

    console.log(
      "[SUBAGENT TOOL] assigned tools:",
      tools,
    );

    return {
      created: true,
      agent,
    };
  },
};