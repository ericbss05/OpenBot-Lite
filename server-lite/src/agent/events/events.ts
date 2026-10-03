export interface RunContext {
  runId: string;
  channelId?: string;
  agentId: string;
  actorId: string;
}

export interface EventMessage {
  id: string;
  channelId: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentId: string | null;
  createdAt: string;
}

export type AgentEvent =
  // ─────────────────────────────────────────────
  // Connection / channel
  // ─────────────────────────────────────────────

  | {
      type: "channel.connected";
      context: RunContext;
    }

  // ─────────────────────────────────────────────
  // Messages
  // ─────────────────────────────────────────────

  | {
      type: "message.created";
      context: RunContext;
      message: EventMessage;
    }

  | {
      type: "message.updated";
      context: RunContext;
      message: EventMessage;
    }

  // ─────────────────────────────────────────────
  // Run lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "run.started";
      context: RunContext;
    }

  | {
      type: "run.completed";
      context: RunContext;
    }

  | {
      type: "run.failed";
      context: RunContext;
      error: string;
    }

  // ─────────────────────────────────────────────
  // LLM lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "llm.started";
      context: RunContext;
    }

  | {
      type: "llm.completed";
      context: RunContext;
    }

  // ─────────────────────────────────────────────
  // Tool lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "tool.started";
      context: RunContext;
      toolCallId: string;
      toolId: string;
      arguments: Record<string, unknown>;
    }

  | {
      type: "tool.completed";
      context: RunContext;
      toolCallId: string;
      toolId: string;
      status: "success" | "error";
      result?: unknown;
      error?: string;
    }

  // ─────────────────────────────────────────────
  // Approvals
  // ─────────────────────────────────────────────

  | {
      type: "approval.required";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
      arguments: Record<string, unknown>;
    }

  | {
      type: "approval.approved";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
    }

  | {
      type: "approval.rejected";
      context: RunContext;
      approvalId: string;
      toolCallId: string;
      toolId: string;
    }

  // ─────────────────────────────────────────────
  // Agent / sub-agent
  // ─────────────────────────────────────────────

  | {
      type: "agent.started";
      context: RunContext;
    }

  | {
      type: "agent.completed";
      context: RunContext;
      output: string;
    }

  | {
      type: "agent.failed";
      context: RunContext;
      error: string;
    }

  // ─────────────────────────────────────────────
  // Sub-agent lifecycle
  // ─────────────────────────────────────────────

  | {
      type: "subagent.started";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
    }

  | {
      type: "subagent.completed";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
      output?: string;
    }

  | {
      type: "subagent.failed";
      context: RunContext;
      subagentId: string;
      parentAgentId: string;
      error: string;
    };

export interface AgentEventSink {
  emit(event: AgentEvent): void | Promise<void>;
}