import { apiRequest } from "./client";

export type ToolCatalogItem = {
  id: string;
  name: string;
  description: string;
  source: "internal" | "composio";
  provider: string | null;
  requiresApproval: boolean;
  createdAt: string;
};

type ToolsResponse = {
  tools: ToolCatalogItem[];
};

export async function getTools(): Promise<
  ToolCatalogItem[]
> {
  const response =
    await apiRequest<ToolsResponse>("/api/tools");

  return response.tools;
}

export async function getTool(
  toolId: string,
): Promise<ToolCatalogItem> {
  return apiRequest<ToolCatalogItem>(
    `/api/tools/${toolId}`,
  );
}
