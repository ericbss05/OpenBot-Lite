import { describe, expect, test } from "bun:test";
import { decideAction, DEFAULT_ACTION_POLICY } from "../src/gateway/policy";

describe("policy", () => {
  test("deny beats allow", () => {
    const decision = decideAction(
      {
        mode: "enforce",
        deny: ['tool.name == "secret"'],
        allow: ["true"],
      },
      {
        tool: { name: "secret" },
        bot: { id: "b" },
        actor: { id: "u" },
      },
    );
    expect(decision.allowed).toBe(false);
  });

  test("default allows when allow is true", () => {
    const decision = decideAction(DEFAULT_ACTION_POLICY, {
      tool: { name: "computer_click" },
      bot: { id: "b" },
      actor: { id: "u" },
    });
    expect(decision.allowed).toBe(true);
  });
});
