import type { Agent } from "./agent";
import type {
  LLMMessage,
  LLMToolCall,
  LLMProvider,
} from "./llm/provider";
import type { ToolRegistry } from "./tools/tools";
import type { AgentRuntime } from "./runtime/runtime";
import type {
  AgentEventSink,
  RunContext,
} from "./events/events";
import { RuntimeHistory } from "./runtime/history";
import type { RuntimeState } from "./runtime/state";

export type ConversationStatus =
| "completed"
| "waiting"
| "failed";

export interface ConversationState {
agent: Agent;
context: RunContext;
history: LLMMessage[];
runtimeState: RuntimeState;
}

export interface ConversationResult {
status: ConversationStatus;
runId: string;
content?: string;
error?: string;
pendingApprovalId?: string;
pendingToolCall?: LLMToolCall;
state: ConversationState;
}

export class AgentConversation {
constructor(
private readonly llm: LLMProvider,
private readonly tools: ToolRegistry,
private readonly runtime: AgentRuntime,
private readonly events?: AgentEventSink,
private readonly maxTurns = 10,
) {}

async run(
agent: Agent,
messages: LLMMessage[],
context: RunContext,
): Promise<ConversationResult> {
if (messages.length === 0) {
throw new Error(
"Cannot run conversation without messages.",
);
}
if (context.agentId !== agent.id) {
  throw new Error(
    "RunContext agentId does not match the conversation agent.",
  );
}

const history = new RuntimeHistory([
  ...messages,
]);

const runtimeState: RuntimeState = {
  runId: context.runId,
  context,
  agent,
  status: "pending",
  messages: [...messages],
  turn: 0,
  maxTurns: 1,
  toolResults: [],
};

return this.continueConversation(
  agent,
  context,
  history,
  runtimeState,
);

}


async resume(
  state: ConversationState,
  decision: "approved" | "rejected",
): Promise<ConversationResult> {
  const pendingToolCall =
    state.runtimeState.pendingToolCall;

  if (!pendingToolCall) {
    throw new Error(
      "No pending tool call in conversation state.",
    );
  }

  const runtimeState =
    await this.runtime.resume(
      state.runtimeState,
      decision,
    );

  const history =
    new RuntimeHistory(
      state.history,
    );

  if (decision === "rejected") {
    history.addToolResult(
      pendingToolCall.id,
      {
        error:
          "Tool execution rejected by the user.",
      },
    );

    runtimeState.pendingApprovalId =
      undefined;

    runtimeState.pendingToolCall =
      undefined;

    runtimeState.messages =
      history.getMessages();

    return this.continueConversation(
      state.agent,
      state.context,
      history,
      runtimeState,
    );
  }

  const lastToolResult =
    runtimeState.toolResults[
      runtimeState.toolResults.length - 1
    ];

  if (!lastToolResult) {
    throw new Error(
      "Approved tool produced no result.",
    );
  }

  const content =
    lastToolResult.status === "success"
      ? lastToolResult.output
      : {
          error:
            lastToolResult.error,
        };

  history.addToolResult(
    pendingToolCall.id,
    content,
  );

  runtimeState.pendingApprovalId =
    undefined;

  runtimeState.pendingToolCall =
    undefined;

  runtimeState.messages =
    history.getMessages();

  return this.continueConversation(
    state.agent,
    state.context,
    history,
    runtimeState,
  );
}

private async continueConversation(
agent: Agent,
context: RunContext,
history: RuntimeHistory,
runtimeState: RuntimeState,
): Promise<ConversationResult> {
for (
let turn = 0;
turn < this.maxTurns;
turn += 1
) {
console.log(
"[AGENT] generating response...",
);

  await this.events?.emit({
    type: "llm.started",
    context,
  });

  const response =
    await this.llm.generate({
      agent,
      messages:
        history.getMessages(),
      tools: this.tools.list(
        agent.tools,
      ),
    });

  await this.events?.emit({
    type: "llm.completed",
    context,
  });

  console.log(
    "[AGENT] LLM response:",
    response,
  );

  if (response.type === "text") {
    history.addAssistantMessage(
      response.content,
    );

    runtimeState.status =
      "completed";

    runtimeState.result =
      response.content;

    runtimeState.messages =
      history.getMessages();

    await this.events?.emit({
      type: "agent.completed",
      context,
      output:
        response.content,
    });

    return {
      status: "completed",
      runId: context.runId,
      content:
        response.content,
      state: {
        agent,
        context,
        history:
          history.getMessages(),
        runtimeState,
      },
    };
  }

  history.addAssistantToolCalls(
    response.calls,
  );

  for (const call of response.calls) {
    console.log(
      "[AGENT] tool requested:",
      {
        toolId: call.toolId,
        arguments: call.arguments,
      },
    );

    const execution =
      await this.runtime.executeTool(
        context,
        call,
      );

    if (
      execution.status ===
      "approval_required"
    ) {
      runtimeState.status =
        "waiting";

      runtimeState.pendingApprovalId =
        execution.approvalId;

      runtimeState.pendingToolCall =
        call;

      runtimeState.messages =
        history.getMessages();

      return {
        status: "waiting",
        runId: context.runId,
        pendingApprovalId:
          execution.approvalId,
        pendingToolCall: call,
        state: {
          agent,
          context,
          history:
            history.getMessages(),
          runtimeState,
        },
      };
    }

    if (
      execution.status ===
      "denied"
    ) {
      history.addToolResult(
        call.id,
        {
          error:
            execution.reason ??
            "Tool execution denied by Gateway.",
        },
      );

      continue;
    }

    if (!execution.result) {
      history.addToolResult(
        call.id,
        {
          error:
            "Tool execution returned no result.",
        },
      );

      continue;
    }

    const toolResult =
      execution.result;

    const content =
      toolResult.status ===
      "success"
        ? toolResult.output
        : {
            error:
              toolResult.error,
          };

    history.addToolResult(
      call.id,
      content,
    );
  }
}

const error =
  `Maximum conversation turns exceeded: ${this.maxTurns}`;

runtimeState.status = "failed";
runtimeState.error = error;
runtimeState.messages =
  history.getMessages();

await this.events?.emit({
  type: "agent.failed",
  context,
  error,
});

return {
  status: "failed",
  runId: context.runId,
  error,
  state: {
    agent,
    context,
    history:
      history.getMessages(),
    runtimeState,
  },
};

}
}
