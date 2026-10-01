import assert from "node:assert/strict";
import {
  DEFAULT_ACTION_POLICY,
  decideAction,
  type ActionPolicy,
  type PolicyContext,
} from "../policy";

const context: PolicyContext = {
  tool: {
    name: "current_time",
  },
  bot: {
    id: "test-agent",
  },
  actor: {
    id: "test-user",
  },
};

console.log("============================================================");
console.log("  TEST GATEWAY — POLICY");
console.log("============================================================");

const allowed = decideAction(DEFAULT_ACTION_POLICY, context);

assert.equal(allowed.allowed, true);
assert.equal(allowed.dryRun, false);

console.log("✅ Policy par défaut : action autorisée");

const denyPolicy: ActionPolicy = {
  mode: "enforce",
  deny: ['tool.name == "current_time"'],
  allow: ["true"],
};

const denied = decideAction(denyPolicy, context);

assert.equal(denied.allowed, false);
assert.match(denied.reason, /deny/);

console.log("✅ Deny prioritaire : action refusée");

const failClosedPolicy: ActionPolicy = {
  mode: "enforce",
  deny: [],
  allow: ['tool.name == "another_tool"'],
};

const failClosed = decideAction(failClosedPolicy, context);

assert.equal(failClosed.allowed, false);

console.log("✅ Fail-closed : action refusée sans allow correspondant");

const dryRunPolicy: ActionPolicy = {
  mode: "dry-run",
  deny: [],
  allow: ["true"],
};

const dryRun = decideAction(dryRunPolicy, context);

assert.equal(dryRun.allowed, true);
assert.equal(dryRun.dryRun, true);

console.log("✅ Dry-run : action autorisée mais marquée dry-run");

console.log("");
console.log("✅ TEST POLICY RÉUSSI");
console.log("============================================================");
