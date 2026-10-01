export type AgentEvent =
  | {
      type: "run.started";
      runId: string;
      agentId: string;
    }
  | {
      type: "llm.started";
      runId: string;
    }
  | {
      type: "llm.completed";
      runId: string;
    }
  | {
      type: "tool.started";
      runId: string;
      toolCallId: string;
      toolId: string;
    }
  | {
      type: "tool.completed";
      runId: string;
      toolCallId: string;
      toolId: string;
      status: "success" | "error";
    }
  | {
      type: "approval.required";
      runId: string;
      approvalId: string;
      toolCallId: string;
    }
  | {
      type: "agent.completed";
      runId: string;
      output: string;
    }
  | {
      type: "agent.failed";
      runId: string;
      error: string;
    };

export interface AgentEventSink {
  emit(event: AgentEvent): void | Promise<void>;
}
