import { serve } from "bun";

import { AgentRuntime } from "./agent/runtime/runtime";
import { OpenAIProvider } from "./agent/llm/providers/openai";
import { createAgentStore as createRuntimeAgentStore } from "./agent/store";
import {
  ToolExecutor,
  ToolRegistry,
} from "./agent/tools/tools";
import { calculatorTool } from "./agent/tools/internal/calculator";
import { createSubAgentTool } from "./agent/tools/internal/create-sub-agent";

import { createAgentStore } from "./agent-profiles/store";
import { createApp } from "./app";
import { createAuthMiddleware } from "./auth/guards";

import {
  createChannelService,
  createChannelStore,
} from "./channels";

import { loadConfig } from "./config";
import { db } from "./db";

import { createAuditStore } from "./gateway/audit";
import { GatewayExecutor } from "./gateway/executor";
import { createGateway } from "./gateway/store";

import { createPluginStore } from "./plugins/store";

import { createRoutineRunner } from "./routines/runner";
import { createRoutineStore } from "./routines/store";

import { createTurnRunner } from "./work/runner";
import { createWorkQueue } from "./work/queue";

import { ToolAuthorizationService } from "./agent/authorization";

import { createToolStore } from "./tools/store";
import { createAgentToolRoutes } from "./routes/agent-tools";

import {
  createPostgresApprovalStore,
} from "./agent/approvals/postgres-store";
import {
  eventHub,
} from "./agent/events/hub";
import { createConversationStore } from "./agent/conversation-store";

const conversationStore =
  createConversationStore();

const config = loadConfig();

// --------------------------------------------------
// Agent profiles
// --------------------------------------------------

const approvals =
  createPostgresApprovalStore(db);

const agents = createAgentStore(
  db,
  config.ALLOW_PRIVATE_HOSTS,
);

await agents.syncFromYaml("agents.yaml");

// --------------------------------------------------
// Runtime dependencies
// --------------------------------------------------

const runtimeAgents =
  createRuntimeAgentStore(db);

// --------------------------------------------------
// LLM
// --------------------------------------------------

const llm =
  new OpenAIProvider();

// --------------------------------------------------
// Tools
// --------------------------------------------------

const tools =
  new ToolRegistry();

tools.register(
  calculatorTool,
);

tools.register(
  createSubAgentTool,
);

const toolExecutor =
  new ToolExecutor(tools);

// --------------------------------------------------
// Channels
// --------------------------------------------------

const channelStore =
  createChannelStore(db);

const channels =
  createChannelService(
    channelStore,
  );

// --------------------------------------------------
// Audit
// --------------------------------------------------

const audit =
  createAuditStore(db);

// --------------------------------------------------
// Gateway
// --------------------------------------------------

const gateway =
  createGateway(
    db,
    config.ACTION_POLICY_MODE,
  );

await gateway.start();

const authorization =
  new ToolAuthorizationService(
    db,
  );

const gatewayExecutor =
  new GatewayExecutor(
    tools,
    toolExecutor,
    gateway,
    audit,
    authorization,
  );

// --------------------------------------------------
// Work queue
// --------------------------------------------------

const queue =
  createWorkQueue(db);

// --------------------------------------------------
// Runtime factory
// --------------------------------------------------

function createRuntime(actorId: string) {
  return new AgentRuntime({
    llm,
    tools,
    gateway: gatewayExecutor,
    agents: runtimeAgents,
    approvals,
    actorId,
    events: eventHub,
  });
}

// --------------------------------------------------
// Routines / plugins
// --------------------------------------------------

const routines =
  createRoutineStore(db);

const plugins =
  createPluginStore(db);

// --------------------------------------------------
// Channel turn runner
// --------------------------------------------------

const turnRunner =
  createTurnRunner({
    queue,
    channels: channelStore,
    audit,
    approvals,
    llm,
    tools,
    conversationStore,
    events: eventHub,

    getAgent: (agentId) =>
      runtimeAgents.get(agentId),

    createRuntime,
  });


turnRunner.start();

// --------------------------------------------------
// Routine runner
// --------------------------------------------------

const routineRunner =
  createRoutineRunner({
    routines,
    channels: channelStore,
    queue,
  });

routineRunner.start();

// --------------------------------------------------
// HTTP application
// --------------------------------------------------

const toolStore =
  createToolStore(db);

const agentToolRoutes =
  createAgentToolRoutes(
    db,
    agents,
  );

const app =
  createApp({
    config,
    auth: createAuthMiddleware(),
    agents,
    channels,
    gateway,
    audit,
    queue,
    routines,
    plugins,
    approvals,
    tools: toolStore,
    agentTools: agentToolRoutes,
    resumeApproval: turnRunner.resumeApproval,
    resumeUserInteraction:
  turnRunner.resumeUserInteraction,
  });

// --------------------------------------------------
// Server
// --------------------------------------------------

const port = config.PORT;

console.log(
  `OpenBot Server Lite listening on http://127.0.0.1:${port}`,
);

serve({
  fetch: app.fetch,
  port,
  idleTimeout: 0,
});
