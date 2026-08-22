import { describe, expect, it } from "vitest";
import { assessPolicyLocally, validatePolicy, type AgentPolicyInput } from "./risk-engine";

const safePolicy: AgentPolicyInput = {
  agentName: "Treasury Scout",
  strategy: "Monitor stablecoin yield and request approval before rebalancing",
  tokens: ["SOL", "USDC"],
  spendCapUsdc: 500,
  maxTransactions: 25,
  durationHours: 12,
  cooldownMinutes: 10,
};

describe("REDLINE risk engine", () => {
  it("allows a tightly bounded pilot policy", () => {
    const result = assessPolicyLocally(safePolicy);
    expect(result.decision).toBe("ALLOW");
    expect(result.level).toBe("LOW");
    expect(result.score).toBeLessThan(35);
  });

  it("blocks an unbounded high-risk strategy", () => {
    const result = assessPolicyLocally({
      ...safePolicy,
      strategy: "Leveraged cross-chain flash arbitrage",
      tokens: ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"],
      spendCapUsdc: 50_000,
      maxTransactions: 800,
      durationHours: 168,
      cooldownMinutes: 1,
    });
    expect(result.decision).toBe("BLOCK");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("rejects malformed policies", () => {
    expect(validatePolicy({ ...safePolicy, tokens: [], spendCapUsdc: -1 })).toHaveLength(2);
  });
});
