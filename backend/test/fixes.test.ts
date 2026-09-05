import { describe, expect, it } from "vitest";
import { isTransientChainError } from "../src/chain/solana.js";
import { canonicalJson } from "../src/routes/agents.js";
import { redactPayload } from "../src/redact.js";
import { withoutModel, type Grounding } from "../src/routes/assistant.js";

// Regression tests for the logic bugs found in the audit of fc0a4e4. Each one
// is written as the failure was observed, so a reintroduction reads as the
// original symptom rather than as an abstract assertion.

class FakeSolanaError extends Error {
  context: Record<string, unknown>;
  constructor(m: string, c: Record<string, unknown>) { super(m); this.context = c; }
}

describe("transient chain error classification", () => {
  it("does not mistake a slot number containing 429 for throttling", () => {
    // A program rejection at slot 300429111 used to be retried six times and
    // then kept the run alive forever as "RPC throttled".
    const e = new FakeSolanaError("Transaction failed: custom program error 0x177b", { slot: 300_429_111n, err: { InstructionError: [0, { Custom: 6011 }] } });
    expect(isTransientChainError(e)).toBe(false);
  });
  it("does not mistake a signature or lamport amount containing 429 for throttling", () => {
    expect(isTransientChainError(new FakeSolanaError("block height exceeded", { signature: "5Kd429xQmZ7pRtYw8vBnLcJhGfEaD3sUiO2NkVbX9Mq" }))).toBe(false);
    expect(isTransientChainError(new Error("Transfer: insufficient lamports 1429000, need 2000000"))).toBe(false);
  });
  it("still treats a structured HTTP 429 / 503 as transient", () => {
    expect(isTransientChainError(new FakeSolanaError("HTTP error (429): Too Many Requests", { statusCode: 429 }))).toBe(true);
    expect(isTransientChainError(new FakeSolanaError("HTTP error (503): Service Unavailable", { statusCode: 503 }))).toBe(true);
    expect(isTransientChainError(new FakeSolanaError("rpc transport failed", { __code: 8100002, statusCode: 502 }))).toBe(true);
  });
  it("treats socket-level failures as transient", () => {
    expect(isTransientChainError(new Error("fetch failed"))).toBe(true);
    expect(isTransientChainError(new Error("read ECONNRESET"))).toBe(true);
  });
});

describe("agent config hashing", () => {
  it("distinguishes configs that differ only in nested keys", () => {
    // JSON.stringify(value, sortedTopLevelKeys) whitelists keys at every
    // depth, so `{a:{b:1}}` and `{a:{b:2}}` both became `{"a":{}}` and hashed
    // to the same agent identity.
    expect(canonicalJson({ a: { b: 1 } })).not.toBe(canonicalJson({ a: { b: 2 } }));
    expect(canonicalJson({ a: { b: 1 } })).toBe('{"a":{"b":1}}');
  });
  it("is order-independent at every depth", () => {
    expect(canonicalJson({ z: 1, a: { d: [1, { y: 2, x: 1 }], c: "s" } })).toBe(canonicalJson({ a: { c: "s", d: [1, { x: 1, y: 2 }] }, z: 1 }));
  });
  it("matches the old output for the flat configs the dashboard sends, so existing agentHashes are stable", () => {
    const cfg = { strategy: "staged rebalance" };
    expect(canonicalJson(cfg)).toBe(JSON.stringify(cfg, Object.keys(cfg).sort()));
    expect(canonicalJson({})).toBe("{}");
  });
});

describe("redaction keeps timestamps", () => {
  it("passes Date values through instead of flattening them to {}", () => {
    const expiresAt = new Date("2026-09-06T00:00:00Z");
    const out = redactPayload({ expiresAt, ownerWallet: "CjTtqFRVUoXZrFoLcgfhSTSNQMWtgS8oG4ETFX4KtgFr" });
    expect(out.expiresAt).toBe(expiresAt);
    expect(out.ownerWallet).toBe("CjTt…tgFr");
  });
});

describe("assistant gate advice matches POLICY_GATES numbering", () => {
  const grounded = (busiest: number, reason: string): Grounding => ({
    scope: "wallet",
    grants: { active: 1, total: 1, revoked: 0, expiringWithinHours: 40 },
    spend: { spentUsdc: 0, capUsdc: 100, transactions: 0 },
    decisions: { allowed: 0, refused: 3, byReason: { [reason]: 3 } },
    gates: [1, 2, 3, 4, 5, 6, 7].map(id => ({ id, label: `gate ${id}`, detail: "", refusals: id === busiest ? 3 : 0 })),
    reasonCodes: {},
  });
  it("gate 3 (nonce) tells the owner to refresh state, not to change token", () => {
    const { suggestions } = withoutModel(grounded(3, "NONCE_REPLAY"), "why is my agent stuck?");
    expect(suggestions.some(s => s.title === "Refresh the transaction state")).toBe(true);
    expect(suggestions.some(s => s.title === "Use an allowed token")).toBe(false);
  });
  it("gate 4 (mint) talks about the token, gate 5 (destination) about the recipient", () => {
    expect(withoutModel(grounded(4, "MINT_NOT_ALLOWED"), "why is my agent stuck?").suggestions.some(s => s.title === "Use an allowed token")).toBe(true);
    expect(withoutModel(grounded(5, "DESTINATION_NOT_ALLOWED"), "why is my agent stuck?").suggestions.some(s => s.title === "Use an allowed destination")).toBe(true);
  });
});
