import type { Agent, AgentStore } from "../agent";

export interface AgentTask {
  id: string;
  parentAgentId: string;
  agentId: string;
  task: string;
}

export interface AgentTaskResult {
  taskId: string;
  status: "success" | "error";
  output?: string;
  error?: string;
}

export interface AgentRunner {
  run(
    agent: Agent,
    message: string,
  ): Promise<AgentTaskResult>;
}

export class DelegationService {
  constructor(
    private readonly agents: AgentStore,
    private readonly runner: AgentRunner,
  ) {}

  async delegate(
    task: AgentTask,
  ): Promise<AgentTaskResult> {
    const agent = await this.agents.get(task.agentId);

    if (!agent) {
      return {
        taskId: task.id,
        status: "error",
        error: `Agent not found: ${task.agentId}`,
      };
    }

    return this.runner.run(agent, task.task);
  }
}
