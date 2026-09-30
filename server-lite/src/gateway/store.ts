import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { actionPolicy } from "../db/schema";
import {
  type ActionPolicy,
  DEFAULT_ACTION_POLICY,
  decideAction,
  type PolicyContext,
  type PolicyDecision,
} from "./policy";

const POLICY_ID = "current";

export type Gateway = ReturnType<typeof createGateway>;

export function createGateway(
  db: Db,
  initialMode: "enforce" | "dry-run",
) {
  let cached: ActionPolicy = {
    ...DEFAULT_ACTION_POLICY,
    mode: initialMode,
  };

  async function hydrate() {
    const row = await db
      .select()
      .from(actionPolicy)
      .where(eq(actionPolicy.id, POLICY_ID))
      .limit(1);

    if (row[0]) {
      cached = {
        mode: row[0].mode,
        deny: JSON.parse(row[0].deny) as string[],
        allow: JSON.parse(row[0].allow) as string[],
      };
    } else {
      await db.insert(actionPolicy).values({
        id: POLICY_ID,
        mode: cached.mode,
        deny: JSON.stringify(cached.deny),
        allow: JSON.stringify(cached.allow),
      });
    }
  }

  return {
    async start() {
      await hydrate();
    },

    getPolicy() {
      return cached;
    },

    async setPolicy(next: ActionPolicy) {
      cached = next;

      await db
        .update(actionPolicy)
        .set({
          mode: next.mode,
          deny: JSON.stringify(next.deny),
          allow: JSON.stringify(next.allow),
        })
        .where(eq(actionPolicy.id, POLICY_ID));
    },

    evaluate(ctx: PolicyContext): PolicyDecision {
      return decideAction(cached, ctx);
    },
  };
}
