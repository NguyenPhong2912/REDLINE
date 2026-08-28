import Fastify from "fastify";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeAssessments, riskRoutes } from "../src/routes/risk.js";

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

async function build() {
  const app = Fastify({ logger: false });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid input" });
    return reply.code(err.statusCode ?? 500).send({ error: err.message });
  });
  await app.register(riskRoutes);
  await app.ready();
  return app;
}

// No OPENAI_API_KEY: the route must answer from the deterministic rules alone.
beforeEach(() => { delete process.env.OPENAI_API_KEY; });
afterEach(() => {
  if (originalApiKey) process.env.OPENAI_API_KEY = originalApiKey;
  else delete process.env.OPENAI_API_KEY;
});

describe("POST /risk-assess", () => {
  it("returns a deterministic allow verdict when OpenAI is not configured", async () => {
    const app = await build();
    const res = await app.inject({ method: "POST", url: "/risk-assess", payload: safePolicy });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.decision).toBe("ALLOW");
    expect(body.source).toBe("deterministic-fallback");
  });

  it("blocks a high-blast-radius policy", async () => {
    const app = await build();
    const res = await app.inject({
      method: "POST",
      url: "/risk-assess",
      payload: {
        ...safePolicy,
        strategy: "Leveraged cross-chain flash arbitrage",
        tokens: ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"],
        spendCapUsdc: 50_000,
        maxTransactions: 800,
        durationHours: 168,
        cooldownMinutes: 1,
      },
    });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.decision).toBe("BLOCK");
    expect(body.score).toBe(100);
  });

  // The middle band is the one grant registration acts on: it recomputes this
  // verdict itself, so a browser that skips the acceptance prompt cannot also
  // report the policy as ALLOW.
  it("puts a broad but not extreme policy in REVIEW", async () => {
    const app = await build();
    const res = await app.inject({
      method: "POST",
      url: "/risk-assess",
      payload: { ...safePolicy, spendCapUsdc: 15_000, maxTransactions: 150, durationHours: 100, cooldownMinutes: 4 },
    });
    const body = res.json();

    expect(body.decision).toBe("REVIEW");
    expect(body.score).toBeGreaterThanOrEqual(60);
    expect(body.score).toBeLessThan(80);
  });

  it("rejects malformed input", async () => {
    const app = await build();
    expect((await app.inject({ method: "POST", url: "/risk-assess", payload: {} })).statusCode).toBe(400);
    expect((await app.inject({
      method: "POST",
      url: "/risk-assess",
      payload: { ...safePolicy, spendCapUsdc: 1 },
    })).statusCode).toBe(400);
  });
});

describe("deterministic floor", () => {
  it("keeps deterministic rules as a non-reducible safety floor", () => {
    const baseline = {
      score: 100,
      level: "CRITICAL" as const,
      decision: "BLOCK" as const,
      summary: "Policy exceeds the safety envelope.",
      findings: ["High transaction allowance increases blast radius."],
      recommendations: ["Reduce the transaction ceiling."],
      source: "deterministic-fallback",
      model: "redline-rules-v1",
    };
    const optimisticAi = {
      score: 12,
      level: "LOW" as const,
      decision: "ALLOW" as const,
      summary: "Looks safe.",
      findings: ["Short explanation."],
      recommendations: ["Monitor it."],
      source: "openai",
      model: "test-model",
    };
    const merged = mergeAssessments(baseline, optimisticAi, "test-model");

    expect(merged.decision).toBe("BLOCK");
    expect(merged.level).toBe("CRITICAL");
    expect(merged.score).toBe(100);
    expect(merged.source).toBe("openai+deterministic-floor");
  });

  it("lets the model raise severity above the baseline", () => {
    const baseline = {
      score: 20,
      level: "LOW" as const,
      decision: "ALLOW" as const,
      summary: "Bounded.",
      findings: ["Narrow scope."],
      recommendations: ["Keep alerts on."],
      source: "deterministic-fallback",
      model: "redline-rules-v1",
    };
    const strictAi = {
      score: 65,
      level: "HIGH" as const,
      decision: "REVIEW" as const,
      summary: "Destination allowlist is unusually broad.",
      findings: ["Broad destination set."],
      recommendations: ["Require human approval."],
      source: "openai",
      model: "test-model",
    };
    const merged = mergeAssessments(baseline, strictAi, "test-model");

    expect(merged.decision).toBe("REVIEW");
    expect(merged.level).toBe("HIGH");
    expect(merged.score).toBe(65);
    expect(merged.summary).toBe("Destination allowlist is unusually broad.");
  });
});
