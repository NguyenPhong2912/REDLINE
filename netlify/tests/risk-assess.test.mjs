import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { handler, mergeAssessments } from "../functions/risk-assess.mjs";

const originalApiKey = process.env.OPENAI_API_KEY;

const safePolicy = {
  agentName: "Treasury Scout",
  strategy: "Monitor stablecoin yield and request approval before rebalancing",
  tokens: ["SOL", "USDC"],
  spendCapUsdc: 500,
  maxTransactions: 25,
  durationHours: 12,
  cooldownMinutes: 10,
};

function event(httpMethod, body = "") {
  return { httpMethod, body };
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
});

afterAll(() => {
  if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
  else delete process.env.OPENAI_API_KEY;
});

describe("risk assessment function", () => {
  it("returns a deterministic allow verdict when OpenAI is not configured", async () => {
    const result = await handler(event("POST", JSON.stringify(safePolicy)));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.decision).toBe("ALLOW");
    expect(body.source).toBe("deterministic-fallback");
  });

  it("blocks a high-blast-radius policy", async () => {
    const result = await handler(event("POST", JSON.stringify({
      ...safePolicy,
      strategy: "Leveraged cross-chain flash arbitrage",
      tokens: ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"],
      spendCapUsdc: 50_000,
      maxTransactions: 800,
      durationHours: 168,
      cooldownMinutes: 1,
    })));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.decision).toBe("BLOCK");
    expect(body.score).toBe(100);
  });

  it("rejects malformed requests and unsupported methods", async () => {
    expect((await handler(event("POST", "{"))).statusCode).toBe(400);
    expect((await handler(event("POST", JSON.stringify({})))).statusCode).toBe(400);
    expect((await handler(event("GET"))).statusCode).toBe(405);
    expect((await handler(event("OPTIONS"))).statusCode).toBe(204);
  });

  it("keeps deterministic rules as a non-reducible safety floor", () => {
    const baseline = {
      score: 100,
      level: "CRITICAL",
      decision: "BLOCK",
      summary: "Policy exceeds the safety envelope.",
      findings: ["High transaction allowance increases blast radius."],
      recommendations: ["Reduce the transaction ceiling."],
    };
    const optimisticAi = {
      score: 12,
      level: "LOW",
      decision: "ALLOW",
      summary: "Looks safe.",
      findings: ["Short explanation."],
      recommendations: ["Monitor it."],
    };
    const merged = mergeAssessments(baseline, optimisticAi, "test-model");

    expect(merged.decision).toBe("BLOCK");
    expect(merged.level).toBe("CRITICAL");
    expect(merged.score).toBe(100);
    expect(merged.source).toBe("openai+deterministic-floor");
  });
});
