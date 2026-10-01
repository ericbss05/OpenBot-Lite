export interface Agent {
  id: string;
  name: string;
  instructions: string;
  model: string;
  tools: string[];
  subAgents: string[];
}

export interface AgentStore {
  get(agentId: string): Promise<Agent | null>;
}
