import { serve } from "bun";
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
import { createGateway } from "./gateway/store";
import { createPluginStore } from "./plugins/store";
import { createRoutineRunner } from "./routines/runner";
import { createRoutineStore } from "./routines/store";
import { createTurnRunner } from "./work/runner";
import { createWorkQueue } from "./work/queue";

const config = loadConfig();

const agents = createAgentStore(
  db,
  config.ALLOW_PRIVATE_HOSTS,
);

await agents.syncFromYaml("agents.yaml");

const channelStore = createChannelStore(db);
const channels = createChannelService(channelStore);

const audit = createAuditStore(db);

const gateway = createGateway(
  db,
  config.ACTION_POLICY_MODE,
);

await gateway.start();

const queue = createWorkQueue(db);
const routines = createRoutineStore(db);
const plugins = createPluginStore(db);

const turnRunner = createTurnRunner({
  queue,
  channels: channelStore,
  agents,
  audit,
});

turnRunner.start();

const routineRunner = createRoutineRunner({
  routines,
  channels: channelStore,
  queue,
});

routineRunner.start();

const app = createApp({
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

const port = config.PORT;

console.log(
  `OpenBot Server Lite listening on http://127.0.0.1:${port}`,
);

serve({
  fetch: app.fetch,
  port,
});