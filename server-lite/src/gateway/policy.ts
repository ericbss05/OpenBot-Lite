/**
 * Même idée que server/src/computer/policy.ts : CEL, deny avant allow, fail-closed.
 */
import { evaluate } from "cel-js";

export type PolicyMode = "dry-run" | "enforce";

export type ActionPolicy = {
  mode: PolicyMode;
  deny: string[];
  allow: string[];
};

export type PolicyContext = {
  tool: { name: string };
  bot: { id: string };
  page?: { url: string; host: string };
  actor: { id: string };
};

export const DEFAULT_ACTION_POLICY: ActionPolicy = {
  mode: "enforce",
  deny: [],
  allow: ["true"],
};

function evalExpr(expr: string, ctx: PolicyContext): boolean {
  try {
    return Boolean(evaluate(expr, ctx as Record<string, unknown>));
  } catch {
    return false;
  }
}

export type PolicyDecision =
  | { allowed: true; dryRun: boolean }
  | { allowed: false; dryRun: boolean; reason: string };

export function decideAction(
  policy: ActionPolicy,
  ctx: PolicyContext,
): PolicyDecision {
  const dryRun = policy.mode === "dry-run";
  for (const expr of policy.deny) {
    if (evalExpr(expr, ctx)) {
      return {
        allowed: false,
        dryRun,
        reason: `Refusé par deny: ${expr}`,
      };
    }
  }
  const permitted = policy.allow.some((expr) => evalExpr(expr, ctx));
  if (!permitted) {
    return {
      allowed: false,
      dryRun,
      reason: "Aucune règle allow ne correspond (fail-closed).",
    };
  }
  return { allowed: true, dryRun };
}
