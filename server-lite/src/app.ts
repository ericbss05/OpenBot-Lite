import { Hono } from "hono";
import { cors } from "hono/cors";

import { auth } from "./auth/auth";
import type {
AppVariables,
createAuthMiddleware,
} from "./auth/guards";
import { requireUser } from "./auth/guards";
import type { LiteConfig } from "./config";

import type { ApprovalStore } from "./agent/approvals/approvals";
import type { AgentStore } from "./agent-profiles/store";
import type { ChannelService } from "./channels/service";
import type { AuditStore } from "./gateway/audit";
import type { Gateway } from "./gateway/store";
import type { PluginStore } from "./plugins/store";
import type { RoutineStore } from "./routines/store";
import type { ToolStore } from "./tools/store";
import type { WorkQueue } from "./work/queue";

import { createAdminRoutes } from "./routes/admin";
import { createAgentRoutes } from "./routes/agents";
import { createAgentToolRoutes } from "./routes/agent-tools";
import { createApprovalRoutes } from "./routes/approvals";
import { createChannelRoutes } from "./routes/channels";
import { createGatewayRoutes } from "./routes/gateway";
import { createInteractionRoutes } from "./routes/interactions";
import { createPluginRoutes } from "./routes/plugins";
import { createRoutineRoutes } from "./routes/routines";
import { createToolRoutes } from "./routes/tools";
import { eventsRoute } from "./routes/events";
import { createHumanControlRoutes } from "./routes/human-control";
import type { ComputerSandboxStore } from "./agent/computer/sandbox-store";
import { createDesktopRoutes } from "./routes/desktop";

type Auth =
ReturnType<typeof createAuthMiddleware>;

export function createApp(deps: {
config: LiteConfig;
auth: Auth;

agents: AgentStore;
channels: ChannelService;

gateway: Gateway;
audit: AuditStore;

queue: WorkQueue;
routines: RoutineStore;
plugins: PluginStore;
tools: ToolStore;

approvals: ApprovalStore;
computer: ComputerSandboxStore;

resumeApproval: (
approvalId: string,
decision: "approved" | "rejected",
) => Promise<unknown>;

resumeUserInteraction: (
runId: string,
answer: string,
) => Promise<unknown>;

resumeHumanControl: (
  runId: string,
) => Promise<unknown>;

agentTools: ReturnType<typeof createAgentToolRoutes> ;
 }) {
 const app =
 new Hono<{
 Variables: AppVariables;
 }>();

// ============================================================
// CORS
// ============================================================

app.use(
"*",
cors({
origin: "http://localhost:3000",
credentials: true,
}),
);

// ============================================================
// Better Auth
// ============================================================

app.all(
"/api/auth/*",
(c) => {
return auth.handler(
c.req.raw,
);
},
);

// ============================================================
// Health
// ============================================================

app.get(
"/health",
(c) =>
c.json({
status: "ok",
}),
);

// ============================================================
// Capabilities
// ============================================================

app.get(
"/api/capabilities",
(c) =>
c.json({
mode: "lite",
durableHistory: true,
generativeUi: false,
transcription: false,
voice: false,
authProviders: [
"emailAndPassword",
],
ssoConfigured: false,
singleUser:
deps.config.singleUser,
}),
);

// ============================================================
// Authentication middleware
// ============================================================

app.use(
"/api/*",
deps.auth,
);

// ============================================================
// Me
// ============================================================

app.get(
"/api/me",
(c) => {
const user =
requireUser(c);

  return c.json(user);
},

);

// ============================================================
// Agents
// ============================================================

app.route(
"/api/agents",
createAgentRoutes({
agents: deps.agents,
audit: deps.audit,
}),
);

// ============================================================
// Agent Tools
// ============================================================

app.route(
"/api/agents",
deps.agentTools,
);

// ============================================================
// Approvals
// ============================================================

app.route(
"/api/approvals",
createApprovalRoutes({
approvals: deps.approvals,
audit: deps.audit,
resumeApproval:
deps.resumeApproval,
}),
);

// ============================================================
// User Interactions
// ============================================================

app.route(
"/api/interactions",
createInteractionRoutes({
resumeUserInteraction:
deps.resumeUserInteraction,
}),
);

// ============================================================
// Channels
// ============================================================

app.route(
"/api/channels",
createChannelRoutes({
channels: deps.channels,
audit: deps.audit,
queue: deps.queue,
}),
);

// ============================================================
// Tools
// ============================================================

app.route(
"/api/tools",
createToolRoutes({
tools: deps.tools,
}),
);

// ============================================================
// Gateway
// ============================================================

app.route(
"/api/gateway",
createGatewayRoutes({
gateway: deps.gateway,
audit: deps.audit,
}),
);

// ============================================================
// Routines
// ============================================================

app.route(
"/api/routines",
createRoutineRoutes({
routines: deps.routines,
audit: deps.audit,
}),
);

// ============================================================
// Plugins
// ============================================================

app.route(
"/api/plugins",
createPluginRoutes({
plugins: deps.plugins,
gateway: deps.gateway,
audit: deps.audit,
}),
);

// ============================================================
// Admin
// ============================================================

app.route(
"/api/admin",
createAdminRoutes({
audit: deps.audit,
gateway: deps.gateway,
}),
);

// ============================================================
// Events
// ============================================================

app.get(
"/api/channels/:channelId/events",
eventsRoute,
);

// ============================================================
// Human Computer Control
// ============================================================

app.route(
  "/api/human-control",
  createHumanControlRoutes({
    resumeHumanControl:
      deps.resumeHumanControl,
  }),
);

app.route(
  "/api/agents",
  createDesktopRoutes({
    computer: deps.computer,
  }),
);

return app;
}
