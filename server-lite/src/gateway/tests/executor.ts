import assert from "node:assert/strict";
import {
  ToolExecutor,
  ToolRegistry,
  type Tool,
} from "../../agent/tools/tools";
import { GatewayExecutor } from "../executor";
import type { Gateway } from "../store";
import type { AuditStore } from "../audit";

const testTool: Tool = {
  definition: {
    id: "gateway_test",
    description: "Tool utilisé pour tester le Gateway.",
    inputSchema: {
      type: "object",
    },
  },

  async execute(arguments_) {
    return {
      ok: true,
      arguments: arguments_,
    };
  },
};

const approvalTool: Tool = {
  definition: {
    id: "gateway_approval_test",
    description: "Tool utilisé pour tester les approvals.",
    inputSchema: {
      type: "object",
    },
    requiresApproval: true,
  },

  async execute() {
    return {
      shouldNotRun: true,
    };
  },
};

const registry = new ToolRegistry();

registry.register(testTool);
registry.register(approvalTool);

const executor = new ToolExecutor(
  registry,
);

const auditEntries: unknown[] = [];

const audit = {
  async record(
    type: string,
    actorId: string,
    payload: Record<string, unknown>,
  ) {
    auditEntries.push({
      type,
      actorId,
      payload,
    });

    return crypto.randomUUID();
  },

  async list() {
    return [];
  },
} as unknown as AuditStore;

const gateway = {
  async start() {},

  getPolicy() {
    return {
      mode: "enforce" as const,
      deny: [],
      allow: ["true"],
    };
  },

  async setPolicy() {},

  evaluate() {
    return {
      allowed: true as const,
      dryRun: false,
    };
  },
} as Gateway;

const gatewayExecutor =
  new GatewayExecutor(
    registry,
    executor,
    gateway,
    audit,
  );

console.log(
  "============================================================",
);

console.log(
  "  TEST GATEWAY — EXECUTION",
);

console.log(
  "============================================================",
);

const result =
  await gatewayExecutor.execute({
    context: {
      runId: "run-test",
      actorId: "user-test",
      botId: "agent-test",
    },

    toolCall: {
      id: "call-test",
      toolId: "gateway_test",
      arguments: {
        hello: "world",
      },
    },
  });

assert.equal(
  result.status,
  "executed",
);

assert.equal(
  result.result?.status,
  "success",
);

console.log(
  "✅ Tool autorisé → exécuté",
);

const approvalResult =
  await gatewayExecutor.execute({
    context: {
      runId: "run-test",
      actorId: "user-test",
      botId: "agent-test",
    },

    toolCall: {
      id: "call-approval-test",
      toolId:
        "gateway_approval_test",
      arguments: {},
    },
  });

assert.equal(
  approvalResult.status,
  "approval_required",
);

console.log(
  "✅ Tool sensible → approval_required",
);

assert.ok(
  auditEntries.length >= 2,
);

console.log(
  "✅ Audit généré",
);

console.log("");

console.log(
  "✅ TEST EXECUTOR RÉUSSI",
);

console.log(
  "============================================================",
);
