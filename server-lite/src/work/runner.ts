import type { LLMMessage } from "../agent/llm/provider";
import type { AgentRuntime } from "../agent/runtime/runtime";
import type { AuditStore } from "../gateway/audit";
import type { WorkQueue } from "./queue";
import {
AgentConversation,
type ConversationState,
} from "../agent/conversation";
import type { LLMProvider } from "../agent/llm/provider";
import type { ToolRegistry } from "../agent/tools/tools";
import type { Agent } from "../agent/agent";
import type {
AgentEventSink,
RunContext,
} from "../agent/events/events";
import type { ConversationStore } from "../agent/conversation-store";
import type { ApprovalStore } from "../agent/approvals/approvals";

export type TurnRunner =
ReturnType<typeof createTurnRunner>;

export function createTurnRunner(deps: {
queue: WorkQueue;
approvals: ApprovalStore;
channels: {
getOwned(
channelId: string,
userId: string,
): Promise<{
id: string;
active: boolean;
} | null>;

history(
  channelId: string,
  limit?: number,
): Promise<
  Array<{
    role:
      | "user"
      | "assistant"
      | "system";
    content: string;
  }>
>;

appendMessage(input: {
  channelId: string;
  role:
    | "user"
    | "assistant"
    | "system";
  content: string;
  agentId?: string;
}): Promise<{
  id: string;
  createdAt: Date;
}>;

};

audit: AuditStore;

llm: LLMProvider;
tools: ToolRegistry;

getAgent(
agentId: string,
): Promise<Agent | null>;

createRuntime: (
actorId: string,
) => AgentRuntime;

conversationStore: ConversationStore;

events?: AgentEventSink;

pollMs?: number;
}) {
const pollMs = deps.pollMs ?? 500;

console.log(
"[TURN RUNNER] Created",
{
events:
deps.events
? "defined"
: "undefined",
pollMs,
},
);

let stopped = false;

async function handleChannelTurn(
payload: Record<string, unknown>,
) {
console.log(
"[TURN RUNNER] Handling channel turn",
{
payload,
},
);

const channelId = String(
  payload.channelId ?? "",
);

const agentId = String(
  payload.agentId ?? "",
);

const actorId = String(
  payload.actorId ?? "",
);

console.log(
  "[TURN RUNNER] Parsed payload",
  {
    channelId,
    agentId,
    actorId,
  },
);

if (!channelId) {
  throw new Error(
    "Channel turn is missing channelId.",
  );
}

if (!agentId) {
  throw new Error(
    "Channel turn is missing agentId.",
  );
}

if (!actorId) {
  throw new Error(
    "Channel turn is missing actorId.",
  );
}

// --------------------------------------------------
// Channel
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Loading channel",
  {
    channelId,
    actorId,
  },
);

const channel =
  await deps.channels.getOwned(
    channelId,
    actorId,
  );

console.log(
  "[TURN RUNNER] Channel loaded",
  {
    found: Boolean(channel),
    active:
      channel?.active ?? null,
  },
);

if (!channel) {
  throw new Error(
    `Channel "${channelId}" not found.`,
  );
}

if (!channel.active) {
  throw new Error(
    `Channel "${channelId}" is inactive.`,
  );
}

// --------------------------------------------------
// History
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Loading history",
  {
    channelId,
    limit: 40,
  },
);

const history =
  await deps.channels.history(
    channelId,
    40,
  );

console.log(
  "[TURN RUNNER] History loaded",
  {
    channelId,
    count: history.length,
  },
);

if (history.length === 0) {
  throw new Error(
    `Channel "${channelId}" has no messages.`,
  );
}

/*
 * Les messages du channel utilisent :
 *
 * user | assistant | system
 *
 * Le runtime utilise :
 *
 * user | assistant | tool
 *
 * Les messages system sont gérés séparément
 * par l'agent / LLM provider.
 */
const messages: LLMMessage[] = [];

for (const message of history) {
  if (
    message.role === "user" ||
    message.role === "assistant"
  ) {
    messages.push({
      role: message.role,
      content: message.content,
    });
  }
}

console.log(
  "[TURN RUNNER] LLM messages prepared",
  {
    channelId,
    count: messages.length,
  },
);

if (messages.length === 0) {
  throw new Error(
    `Channel "${channelId}" has no usable messages.`,
  );
}

// --------------------------------------------------
// Agent
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Loading agent",
  {
    agentId,
  },
);

const agent =
  await deps.getAgent(agentId);

console.log(
  "[TURN RUNNER] Agent loaded",
  {
    found: Boolean(agent),
    agentId,
  },
);

if (!agent) {
  throw new Error(
    `Agent "${agentId}" not found.`,
  );
}

// --------------------------------------------------
// Runtime
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Creating runtime",
  {
    actorId,
  },
);

const runtime =
  deps.createRuntime(actorId);

console.log(
  "[TURN RUNNER] Runtime created",
  {
    exists: Boolean(runtime),
  },
);

console.log(
  "[TURN RUNNER] Creating AgentConversation",
  {
    events:
      deps.events
        ? "defined"
        : "undefined",
  },
);

const conversation =
  new AgentConversation(
    deps.llm,
    deps.tools,
    runtime,
    deps.events,
  );

console.log(
  "[TURN RUNNER] AgentConversation created",
);

const runContext: RunContext = {
  runId: crypto.randomUUID(),
  channelId,
  agentId,
  actorId,
};

console.log(
  "[TURN RUNNER] RunContext created",
  {
    runId: runContext.runId,
    channelId: runContext.channelId,
    agentId: runContext.agentId,
    actorId: runContext.actorId,
  },
);

// --------------------------------------------------
// Conversation
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Starting conversation",
  {
    runId: runContext.runId,
  },
);

const result =
  await conversation.run(
    agent,
    messages,
    runContext,
  );

console.log(
  "[TURN RUNNER] Conversation result",
  {
    status: result.status,
    runId: result.runId,
    content:
      result.content ?? null,
    error:
      result.error ?? null,
    pendingApprovalId:
      result.pendingApprovalId ??
      null,
  },
);

// --------------------------------------------------
// Runtime failed
// --------------------------------------------------

if (result.status === "failed") {
  console.log(
    "[TURN RUNNER] Conversation failed",
    {
      runId: result.runId,
      error: result.error,
    },
  );

  throw new Error(
    result.error ??
      `Agent "${agentId}" conversation failed.`,
  );
}

// --------------------------------------------------
// Runtime waiting for approval / interaction
// --------------------------------------------------

if (result.status === "waiting") {
  console.log(
    "[TURN RUNNER] Conversation waiting",
    {
      runId: result.runId,
      pendingApprovalId:
        result.pendingApprovalId ??
        null,
      pendingInteraction:
        result.pendingInteraction
          ? "present"
          : "none",
    },
  );

  if (!result.state) {
    throw new Error(
      `Conversation "${result.runId}" is waiting but returned no state.`,
    );
  }

  /*
   * IMPORTANT :
   *
   * Le work item va être terminé après le retour
   * de cette fonction. La conversation ne doit donc
   * pas être perdue.
   *
   * On conserve son état en mémoire afin que la route
   * d'approbation ou d'interaction puisse reprendre
   * exactement cette conversation plus tard.
   */
  deps.conversationStore.set(
    result.runId,
    result.state,
  );

  console.log(
    "[TURN RUNNER] Conversation state stored",
    {
      runId: result.runId,
      pendingApprovalId:
        result.pendingApprovalId ??
        null,
      pendingInteraction:
        result.pendingInteraction
          ? "present"
          : "none",
    },
  );

  await deps.audit.record(
    "channel.agent_waiting",
    actorId,
    {
      channelId,
      agentId,
      runId: result.runId,
      pendingApprovalId:
        result.pendingApprovalId ??
        null,
    },
  );

  return;
}

// --------------------------------------------------
// Unexpected runtime status
// --------------------------------------------------

if (result.status !== "completed") {
  console.log(
    "[TURN RUNNER] Unexpected conversation status",
    {
      status: result.status,
      runId: result.runId,
    },
  );

  throw new Error(
    `Agent conversation ended with status "${result.status}".`,
  );
}

const reply =
  result.content?.trim();

console.log(
  "[TURN RUNNER] Reply extracted",
  {
    runId: result.runId,
    hasReply: Boolean(reply),
    length: reply?.length ?? 0,
  },
);

if (!reply) {
  throw new Error(
    `Agent "${agentId}" completed without a response.`,
  );
}

// --------------------------------------------------
// Save assistant response
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Saving assistant message",
  {
    channelId,
    agentId,
    contentLength: reply.length,
  },
);

const message =
  await deps.channels.appendMessage({
    channelId,
    role: "assistant",
    content: reply,
    agentId,
  });

console.log(
  "[TURN RUNNER] Message saved",
  {
    id: message.id,
    createdAt: message.createdAt,
    channelId,
    agentId,
  },
);

// --------------------------------------------------
// Emit message.created
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Preparing message.created",
  {
    eventSink:
      deps.events
        ? "defined"
        : "undefined",
    runId: runContext.runId,
    channelId,
    agentId,
    messageId: message.id,
  },
);

const messageCreatedEvent = {
  type: "message.created" as const,
  context: runContext,
  message: {
    id: message.id,
    channelId,
    role: "assistant" as const,
    content: reply,
    agentId,
    createdAt:
      message.createdAt.toISOString(),
  },
};

console.log(
  "[TURN RUNNER] message.created event built",
  {
    type:
      messageCreatedEvent.type,
    messageId:
      messageCreatedEvent.message.id,
    channelId:
      messageCreatedEvent.message.channelId,
  },
);

if (!deps.events) {
  console.warn(
    "[TURN RUNNER] No event sink available. message.created will NOT be emitted.",
  );
} else {
  console.log(
    "[TURN RUNNER] Calling events.emit",
    {
      eventType:
        messageCreatedEvent.type,
    },
  );

  try {
    await deps.events.emit(
      messageCreatedEvent,
    );

    console.log(
      "[TURN RUNNER] events.emit completed",
      {
        eventType:
          messageCreatedEvent.type,
      },
    );
  } catch (error) {
    console.error(
      "[TURN RUNNER] events.emit failed",
      {
        error,
        eventType:
          messageCreatedEvent.type,
      },
    );

    throw error;
  }
}

// --------------------------------------------------
// Audit
// --------------------------------------------------

console.log(
  "[TURN RUNNER] Recording channel.agent_replied",
  {
    channelId,
    agentId,
    runId: result.runId,
  },
);

await deps.audit.record(
  "channel.agent_replied",
  actorId,
  {
    channelId,
    agentId,
    runId: result.runId,
  },
);

console.log(
  "[TURN RUNNER] Channel turn completed",
  {
    channelId,
    agentId,
    runId: result.runId,
  },
);

}

async function resumeApproval(
approvalId: string,
decision: "approved" | "rejected",
) {
console.log(
"[TURN RUNNER] Resuming approval",
{
approvalId,
decision,
},
);

const approval =
  await deps.approvals.get(
    approvalId,
  );

if (!approval) {
  throw new Error(
    `Approval "${approvalId}" not found.`,
  );
}

if (approval.status !== "pending") {
  throw new Error(
    `Approval "${approvalId}" is already decided: ${approval.status}`,
  );
}

const conversationState =
  deps.conversationStore.get(
    approval.runId,
  );

if (!conversationState) {
  throw new Error(
    `Conversation state not found for run "${approval.runId}".`,
  );
}

if (
  conversationState.runtimeState.pendingApprovalId !==
  approvalId
) {
  throw new Error(
    "Approval does not match the pending conversation state.",
  );
}

console.log(
  "[TURN RUNNER] Conversation state found",
  {
    runId: approval.runId,
    channelId:
      conversationState.context.channelId,
    agentId:
      conversationState.context.agentId,
  },
);

const runtime =
  deps.createRuntime(
    conversationState.context.actorId,
  );

const conversation =
  new AgentConversation(
    deps.llm,
    deps.tools,
    runtime,
    deps.events,
  );

const result =
  await conversation.resume(
    conversationState,
    decision,
  );

console.log(
  "[TURN RUNNER] Resumed conversation result",
  {
    status: result.status,
    runId: result.runId,
    content:
      result.content ?? null,
    error:
      result.error ?? null,
  },
);

if (result.status === "failed") {
  deps.conversationStore.delete(
    result.runId,
  );

  await deps.audit.record(
    "channel.turn_failed",
    conversationState.context.actorId,
    {
      channelId:
        conversationState.context.channelId,
      agentId:
        conversationState.context.agentId,
      runId: result.runId,
      approvalId,
      error:
        result.error ??
        "Conversation failed after approval decision.",
    },
  );

  // A user rejection is an expected outcome,
  // not a server error.
  if (decision === "rejected") {
    return result;
  }

  throw new Error(
    result.error ??
      "Conversation failed after approval decision.",
  );
}

if (result.status === "waiting") {
  if (!result.state) {
    throw new Error(
      "Conversation is waiting again but returned no state.",
    );
  }

  deps.conversationStore.set(
    result.runId,
    result.state,
  );

  await deps.audit.record(
    "channel.agent_waiting",
    conversationState.context.actorId,
    {
      channelId:
        conversationState.context.channelId,
      agentId:
        conversationState.context.agentId,
      runId: result.runId,
      pendingApprovalId:
        result.pendingApprovalId ??
        null,
    },
  );

  return result;
}

if (result.status !== "completed") {
  throw new Error(
    `Unexpected conversation status: ${result.status}`,
  );
}

const reply =
  result.content?.trim();

if (!reply) {
  throw new Error(
    `Agent "${conversationState.context.agentId}" completed without a response.`,
  );
}

const channelId =
  conversationState.context.channelId;

if (!channelId) {
  throw new Error(
    "Conversation context is missing channelId.",
  );
}

const agentId =
  conversationState.context.agentId;

const message =
  await deps.channels.appendMessage({
    channelId,
    role: "assistant",
    content: reply,
    agentId,
  });

console.log(
  "[TURN RUNNER] Resumed assistant message saved",
  {
    id: message.id,
    channelId,
    agentId,
  },
);

await deps.events?.emit({
  type: "message.created",
  context:
    conversationState.context,
  message: {
    id: message.id,
    channelId,
    role: "assistant",
    content: reply,
    agentId,
    createdAt:
      message.createdAt.toISOString(),
  },
});

await deps.audit.record(
  "channel.agent_replied",
  conversationState.context.actorId,
  {
    channelId,
    agentId,
    runId: result.runId,
  },
);

deps.conversationStore.delete(
  result.runId,
);

console.log(
  "[TURN RUNNER] Approval flow completed",
  {
    approvalId,
    runId: result.runId,
    channelId,
    agentId,
  },
);

return result;

}

async function resumeUserInteraction(
runId: string,
answer: string,
) {
console.log(
"[TURN RUNNER] Resuming user interaction",
{
runId,
answer,
},
);

const conversationState =
  deps.conversationStore.get(runId);

if (!conversationState) {
  throw new Error(
    `Conversation state not found for run "${runId}".`,
  );
}

const pendingInteraction =
  conversationState.runtimeState
    .pendingInteraction;

if (!pendingInteraction) {
  throw new Error(
    `Conversation "${runId}" has no pending user interaction.`,
  );
}

console.log(
  "[TURN RUNNER] User interaction state found",
  {
    runId,
    channelId:
      conversationState.context.channelId,
    agentId:
      conversationState.context.agentId,
    toolCallId:
      pendingInteraction.toolCallId,
    type:
      pendingInteraction.interaction.type,
  },
);

const runtime =
  deps.createRuntime(
    conversationState.context.actorId,
  );

const conversation =
  new AgentConversation(
    deps.llm,
    deps.tools,
    runtime,
    deps.events,
  );

const result =
  await conversation.resumeUserInteraction(
    conversationState,
    answer,
  );

console.log(
  "[TURN RUNNER] Resumed user interaction result",
  {
    status: result.status,
    runId: result.runId,
    content:
      result.content ?? null,
    error:
      result.error ?? null,
  },
);

if (result.status === "failed") {
  deps.conversationStore.delete(
    result.runId,
  );

  await deps.audit.record(
    "channel.turn_failed",
    conversationState.context.actorId,
    {
      channelId:
        conversationState.context.channelId,
      agentId:
        conversationState.context.agentId,
      runId: result.runId,
      error:
        result.error ??
        "Conversation failed after user interaction.",
    },
  );

  throw new Error(
    result.error ??
      "Conversation failed after user interaction.",
  );
}

if (result.status === "waiting") {
  if (!result.state) {
    throw new Error(
      "Conversation is waiting again but returned no state.",
    );
  }

  deps.conversationStore.set(
    result.runId,
    result.state,
  );

  await deps.audit.record(
    "channel.agent_waiting",
    conversationState.context.actorId,
    {
      channelId:
        conversationState.context.channelId,
      agentId:
        conversationState.context.agentId,
      runId: result.runId,
      pendingApprovalId:
        result.pendingApprovalId ??
        null,
    },
  );

  return result;
}

if (result.status !== "completed") {
  throw new Error(
    `Unexpected conversation status: ${result.status}`,
  );
}

const reply =
  result.content?.trim();

if (!reply) {
  throw new Error(
    `Agent "${conversationState.context.agentId}" completed without a response.`,
  );
}

const channelId =
  conversationState.context.channelId;

if (!channelId) {
  throw new Error(
    "Conversation context is missing channelId.",
  );
}

const agentId =
  conversationState.context.agentId;

const message =
  await deps.channels.appendMessage({
    channelId,
    role: "assistant",
    content: reply,
    agentId,
  });

console.log(
  "[TURN RUNNER] Resumed assistant message saved",
  {
    id: message.id,
    channelId,
    agentId,
  },
);

await deps.events?.emit({
  type: "message.created",
  context:
    conversationState.context,
  message: {
    id: message.id,
    channelId,
    role: "assistant",
    content: reply,
    agentId,
    createdAt:
      message.createdAt.toISOString(),
  },
});

await deps.audit.record(
  "channel.agent_replied",
  conversationState.context.actorId,
  {
    channelId,
    agentId,
    runId: result.runId,
  },
);

deps.conversationStore.delete(
  result.runId,
);

console.log(
  "[TURN RUNNER] User interaction flow completed",
  {
    runId: result.runId,
    channelId,
    agentId,
  },
);

return result;

}

async function loop() {
console.log(
"[TURN RUNNER] Loop started",
{
pollMs,
},
);

while (!stopped) {
  const item =
    await deps.queue.claim(
      "channel.turn",
    );

  if (item) {
    console.log(
      "[TURN RUNNER] Work item claimed",
      {
        id: item.id,
      },
    );

    try {
      await handleChannelTurn(
        item.payload,
      );

      console.log(
        "[TURN RUNNER] Completing work item",
        {
          id: item.id,
        },
      );

      await deps.queue.complete(
        item.id,
      );

      console.log(
        "[TURN RUNNER] Work item completed",
        {
          id: item.id,
        },
      );
    } catch (error) {
      console.error(
        "[TURN RUNNER] Work item failed",
        {
          id: item.id,
          error,
        },
      );

      await deps.audit.record(
        "channel.turn_failed",
        null,
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
          workId: item.id,
        },
        "system",
      );

      await deps.queue.fail(
        item.id,
      );

      console.log(
        "[TURN RUNNER] Work item marked failed",
        {
          id: item.id,
        },
      );
    }
  }

  await Bun.sleep(pollMs);
}

console.log(
  "[TURN RUNNER] Loop stopped",
);

}

return {
start() {
console.log(
"[TURN RUNNER] start() called",
);

  void loop();
},

stop() {
  console.log(
    "[TURN RUNNER] stop() called",
  );

  stopped = true;
},

resumeApproval,
resumeUserInteraction,

};
}
