import { apiRequest } from "./client";

export type AgentTool = {
  agentId: string;
  toolId: string;
  createdAt: string;
};

type AgentToolsResponse = {
  tools: AgentTool[];
};

export async function getAgentTools(
  agentId: string,
): Promise<AgentTool[]> {
  const response =
    await apiRequest<AgentToolsResponse>(
      `/api/agents/${agentId}/tools`,
    );

  return response.tools;
}

export async function addAgentTool(
  agentId: string,
  toolId: string,
): Promise<AgentTool> {
  const response =
    await apiRequest<{ tool: AgentTool }>(
      `/api/agents/${agentId}/tools`,
      {
        method: "POST",
        body: JSON.stringify({
          toolId,
        }),
      },
    );

  return response.tool;
}

export async function removeAgentTool(
  agentId: string,
  toolId: string,
): Promise<void> {
  await apiRequest(
    `/api/agents/${agentId}/tools/${toolId}`,
    {
      method: "DELETE",
    },
  );
}
