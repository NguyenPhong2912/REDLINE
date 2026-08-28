import type { FastifyInstance } from "fastify";
import OpenAI from "openai";
import { z } from "zod";

// The single origin for the frontend's risk copilot: the dashboard is a static
// site with no serverless functions of its own, so it calls this route.
// Deterministic floor first — the model can only raise severity, never lower it.

const Input = z.object({
  agentName: z.string().trim().min(1).max(80),
  strategy: z.string().trim().min(1).max(200),
  tokens: z.array(z.string().max(12)).min(1).max(8),
  spendCapUsdc: z.number().min(10).max(100_000),
  maxTransactions: z.number().int().min(1).max(1_000),
  durationHours: z.number().int().min(1).max(168),
  cooldownMinutes: z.number().int().min(1).max(120),
});
type RiskInput = z.infer<typeof Input>;

type Decision = "ALLOW" | "REVIEW" | "BLOCK";
type Level = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
interface Assessment { score: number; level: Level; decision: Decision; summary: string; findings: string[]; recommendations: string[]; source: string; model: string }

// Exported so grant registration can recompute the floor for itself instead of
// trusting the verdict a browser reports.
export function deterministic(input: RiskInput): Assessment {
  let score = 8;
  const findings: string[] = [];
  const recommendations: string[] = [];
  const strategy = input.strategy.toLowerCase();
  if (input.spendCapUsdc > 10_000) { score += 28; findings.push("Spend cap exceeds the recommended pilot threshold."); recommendations.push("Stage capital and require approval before increasing exposure."); }
  else if (input.spendCapUsdc > 2_500) score += 14;
  if (input.maxTransactions > 250) { score += 18; findings.push("High transaction allowance increases blast radius."); }
  else if (input.maxTransactions > 100) score += 9;
  if (input.durationHours > 72) score += 16; else if (input.durationHours > 24) score += 7;
  if (input.cooldownMinutes < 3) { score += 20; findings.push("Very short cooldown can amplify repeated execution errors."); recommendations.push("Use at least a five-minute cooldown during the pilot."); }
  else if (input.cooldownMinutes < 5) score += 8;
  if (input.tokens.length > 4) score += 9;
  if (/flash|leverage|perp|arbitrage|cross-chain/.test(strategy)) { score += 18; findings.push("Strategy is sensitive to slippage, latency, or leverage."); recommendations.push("Require simulation and human review before execution."); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: Level = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const decision: Decision = score >= 80 ? "BLOCK" : score >= 60 ? "REVIEW" : "ALLOW";
  if (!findings.length) findings.push("Policy scope is narrow and time-bounded for a pilot.");
  if (!recommendations.length) recommendations.push("Keep simulation and anomaly alerts enabled.");
  return { score, level, decision, summary: decision === "ALLOW" ? "Policy is bounded enough for a monitored Devnet pilot." : decision === "REVIEW" ? "Policy requires human review before signing." : "Policy exceeds the safety envelope and should not be signed.", findings, recommendations, source: "deterministic-fallback", model: "redline-rules-v1" };
}

const decisionRank: Record<Decision, number> = { ALLOW: 0, REVIEW: 1, BLOCK: 2 };
const levelRank: Record<Level, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function mergeAssessments(baseline: Assessment, ai: Assessment, model: string): Assessment {
  const decision = decisionRank[ai.decision] >= decisionRank[baseline.decision] ? ai.decision : baseline.decision;
  const level = levelRank[ai.level] >= levelRank[baseline.level] ? ai.level : baseline.level;
  const floor = decision === "BLOCK" ? 80 : decision === "REVIEW" ? 60 : 0;
  const score = Math.max(baseline.score, ai.score, floor);
  const stricter = decision !== ai.decision || level !== ai.level || score !== ai.score;
  return { score, level, decision, summary: stricter ? baseline.summary : ai.summary, findings: [...new Set([...baseline.findings, ...ai.findings])].slice(0, 5), recommendations: [...new Set([...baseline.recommendations, ...ai.recommendations])].slice(0, 5), source: "openai+deterministic-floor", model };
}

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    decision: { type: "string", enum: ["ALLOW", "REVIEW", "BLOCK"] },
    summary: { type: "string" },
    findings: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    recommendations: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
  },
  required: ["score", "level", "decision", "summary", "findings", "recommendations"],
};

export async function riskRoutes(app: FastifyInstance) {
  app.post("/risk-assess", async (req) => {
    const input = Input.parse(req.body);
    const baseline = deterministic(input);
    const key = process.env.OPENAI_API_KEY;
    if (!key) return baseline;
    try {
      const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
      const client = new OpenAI({ apiKey: key });
      const result = await client.responses.create({
        model, store: false, max_output_tokens: 700,
        instructions: [
          "You are the REDLINE risk copilot for autonomous DeFi agents on Solana.",
          "Assess only operational risk from the supplied policy. Do not predict profit, give investment advice, or invent market data.",
          "Prefer bounded permissions, short validity windows, simulation, allowlists, and human review for high-impact actions.",
          "A BLOCK verdict is appropriate when cumulative blast radius is unacceptable; REVIEW means explicit human approval is required.",
        ].join(" "),
        input: JSON.stringify(input),
        text: { format: { type: "json_schema", name: "redline_agent_risk_assessment", strict: true, schema } },
      });
      return mergeAssessments(baseline, JSON.parse(result.output_text) as Assessment, model);
    } catch {
      return baseline;
    }
  });
}
