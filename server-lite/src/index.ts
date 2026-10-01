import { serve } from "bun";

import { AgentRuntime } from "./agent/runtime/runtime";
import { OpenAIProvider } from "./agent/llm/openai";
import { createAgentStore as createRuntimeAgentStore } from "./agent/store";
import {
  ToolExecutor,
  ToolRegistry,
} from "./agent/tools/tools";

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

const config = loadConfig();

// --------------------------------------------------
// Agent profiles
// --------------------------------------------------

const agents = createAgentStore(
  db,
  config.ALLOW_PRIVATE_HOSTS,
);

await agents.syncFromYaml("agents.yaml");

// --------------------------------------------------
// Runtime dependencies
// --------------------------------------------------

// Store utilisé par AgentRuntime.
// Attention : ce n'est PAS le même AgentStore
// que celui utilisé par l'API CRUD.
const runtimeAgents =
  createRuntimeAgentStore(db);

// LLM
const llm =
  new OpenAIProvider();

// Tools
//
// Pour l'instant le registry est vide.
// Les tools seront enregistrés ici au fur et à mesure.
const tools =
  new ToolRegistry();

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

const gatewayExecutor =
  new GatewayExecutor(
    tools,
    toolExecutor,
    gateway,
    audit,
  );

// --------------------------------------------------
// Work queue
// --------------------------------------------------

const queue =
  createWorkQueue(db);

// --------------------------------------------------
// Runtime factory
// --------------------------------------------------

function createRuntime(
  actorId: string,
) {
  return new AgentRuntime({
    llm,
    tools,
    gateway: gatewayExecutor,
    agents: runtimeAgents,
    actorId,
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
    createRuntime,
    audit,
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
});