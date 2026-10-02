import type { AuditStore } from "../../../gateway/audit";
import type { Gateway } from "../../../gateway/store";
import { GatewayExecutor } from "../../../gateway/executor";

import {
  ToolExecutor,
  type ToolRegistry,
} from "../../tools/tools";

import { ToolAuthorizationService } from "../../authorization";

import { db } from "../../../db";

export function createTestGateway(
  registry: ToolRegistry,
): GatewayExecutor {
  const audit = {
    async record() {
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

  const authorization =
    new ToolAuthorizationService(db);

  return new GatewayExecutor(
    registry,
    new ToolExecutor(registry),
    gateway,
    audit,
    authorization,
  );
}
