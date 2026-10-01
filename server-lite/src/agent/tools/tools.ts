export type ToolInputSchema = Record<string, unknown>;

export interface ToolDefinition {
  id: string;
  description: string;
  inputSchema: ToolInputSchema;
  requiresApproval?: boolean;
}

export interface Tool {
  definition: ToolDefinition;

  execute(
    arguments_: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface ToolCall {
  id: string;
  toolId: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  toolId: string;
  status: "success" | "error";
  output?: unknown;
  error?: string;
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.definition.id)) {
      throw new Error(
        `Tool already registered: ${tool.definition.id}`,
      );
    }

    this.tools.set(tool.definition.id, tool);
  }

  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  list(toolIds?: string[]): ToolDefinition[] {
    const tools = toolIds
      ? toolIds
          .map((id) => this.tools.get(id))
          .filter((tool): tool is Tool => Boolean(tool))
      : [...this.tools.values()];

    return tools.map((tool) => tool.definition);
  }
}

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
  ) {}

  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(call.toolId);

    if (!tool) {
      return {
        toolCallId: call.id,
        toolId: call.toolId,
        status: "error",
        error: `Tool not found: ${call.toolId}`,
      };
    }

    try {
      const output = await tool.execute(call.arguments);

      return {
        toolCallId: call.id,
        toolId: call.toolId,
        status: "success",
        output,
      };
    } catch (error) {
      return {
        toolCallId: call.id,
        toolId: call.toolId,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown tool execution error",
      };
    }
  }
}
