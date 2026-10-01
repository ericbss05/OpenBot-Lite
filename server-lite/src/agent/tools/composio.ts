import { Composio } from "@composio/core";

import type {
  Tool,
  ToolDefinition,
} from "./tools";

export class ComposioToolProvider {
  private readonly composio: Composio;

  constructor(
    apiKey = process.env.COMPOSIO_API_KEY,
  ) {
    if (!apiKey) {
      throw new Error(
        "COMPOSIO_API_KEY is not configured",
      );
    }

    this.composio = new Composio({
      apiKey,
    });
  }

  async getTools(
    userId: string,
    toolkits: string[],
  ): Promise<Tool[]> {
    const tools =
      await this.composio.tools.getRawComposioTools({
        toolkits,
      });

    const composio = this.composio;

    return tools.map((tool) => {
      const inputSchema =
        tool.inputParameters ?? {
          type: "object",
          properties: {},
          additionalProperties: false,
        };

      const definition: ToolDefinition = {
        id: tool.slug,
        description:
          tool.description ??
          tool.name ??
          tool.slug,
        inputSchema:
          inputSchema as Record<string, unknown>,
      };

      return {
        definition,

        async execute(arguments_) {
          return composio.tools.execute(
            tool.slug,
            {
              userId,
              arguments: arguments_,
              dangerouslySkipVersionCheck: true,
            },
          );
        },
      };
    });
  }
}
