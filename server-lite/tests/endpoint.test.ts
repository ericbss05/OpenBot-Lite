import { describe, expect, test } from "bun:test";
import { checkAgentEndpoint } from "../src/agent-profiles/endpoint-check";

describe("endpoint check", () => {
  test("blocks metadata IP", () => {
    const v = checkAgentEndpoint("http://169.254.169.254/latest", false);
    expect(v.allowed).toBe(false);
  });

  test("allows localhost when configured", () => {
    const v = checkAgentEndpoint("http://127.0.0.1:8080/ag-ui", true);
    expect(v.allowed).toBe(true);
  });
});
