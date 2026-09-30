import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function listMcpTools(command: string, args: string[]) {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: "openbot-lite", version: "0.1.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => ({ name: t.name, description: t.description }));
  } finally {
    await client.close();
  }
}

export async function callMcpTool(
  command: string,
  args: string[],
  name: string,
  toolArgs: Record<string, unknown>,
) {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: "openbot-lite", version: "0.1.0" });
  await client.connect(transport);
  try {
    const result = await client.callTool({ name, arguments: toolArgs });
    return result;
  } finally {
    await client.close();
  }
}
