import { apiRequest } from "./client";

export type Agent = {
  id: string;
  name: string;
  title: string | null;
  roleDescription: string | null;
  model: string;
  visibility: "public" | "private";
  endpoint: string | null;
  avatarPalette: number;
  avatarReversed: boolean;
  ownerUserId: string | null;
  createdAt: string;
};

export type CreateAgentInput = {
  name: string;
  title?: string;
  roleDescription?: string;
  endpoint?: string;
  visibility: "private";
  avatarPalette?: number;
  avatarReversed?: boolean;
};

export type UpdateAgentInput = Partial<{
  name: string;
  title: string;
  roleDescription: string;
  model: string;
  visibility: "private";
  endpoint: string;
  avatarPalette: number;
  avatarReversed: boolean;
}>;

export function getAgents() {
  return apiRequest<Agent[]>(
    "/api/agents",
  );
}

export function getAgent(id: string) {
  return apiRequest<Agent>(
    `/api/agents/${id}`,
  );
}

export function createAgent(
  data: CreateAgentInput,
) {
  return apiRequest<Agent>(
    "/api/agents",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function updateAgent(
  id: string,
  data: UpdateAgentInput,
) {
  return apiRequest<Agent>(
    `/api/agents/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export function deleteAgent(id: string) {
  return apiRequest<{
    success: boolean;
  }>(
    `/api/agents/${id}`,
    {
      method: "DELETE",
    },
  );
}