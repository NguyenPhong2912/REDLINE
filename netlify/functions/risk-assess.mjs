import OpenAI from "openai";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function response(statusCode, body) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) };
}

function normalize(value) {
  const input = value && typeof value === "object" ? value : {};
  return {
    agentName: String(input.agentName || "").trim().slice(0, 80),
    strategy: String(input.strategy || "").trim().slice(0, 200),
    tokens: Array.isArray(input.tokens)
      ? [...new Set(input.tokens.map(token => String(token).toUpperCase().slice(0, 12)))].slice(0, 8)
      : [],
    spendCapUsdc: Number(input.spendCapUsdc),
    maxTransactions: Number(input.maxTransactions),
    durationHours: Number(input.durationHours),
    cooldownMinutes: Number(input.cooldownMinutes),
  };
}

function validationErrors(input) {
  const errors = [];
  if (!input.agentName) errors.push("agentName is required");
  if (!input.strategy) errors.push("strategy is required");
  if (input.tokens.length < 1) errors.push("at least one token is required");
  if (!Number.isFinite(input.spendCapUsdc) || input.spendCapUsdc < 10 || input.spendCapUsdc > 100_000) errors.push("invalid spendCapUsdc");
  if (!Number.isInteger(input.maxTransactions) || input.maxTransactions < 1 || input.maxTransactions > 1_000) errors.push("invalid maxTransactions");
  if (!Number.isInteger(input.durationHours) || input.durationHours < 1 || input.durationHours > 168) errors.push("invalid durationHours");
  if (!Number.isInteger(input.cooldownMinutes) || input.cooldownMinutes < 1 || input.cooldownMinutes > 120) errors.push("invalid cooldownMinutes");
  return errors;
}

function deterministicAssessment(input) {
  let score = 8;
  const findings = [];
  const recommendations = [];
  const strategy = input.strategy.toLowerCase();

  if (input.spendCapUsdc > 10_000) {
    score += 28;
    findings.push("Spend cap exceeds the recommended pilot threshold.");
    recommendations.push("Stage capital and require approval before increasing exposure.");
  } else if (input.spendCapUsdc > 2_500) score += 14;

  if (input.maxTransactions > 250) {
    score += 18;
    findings.push("High transaction allowance increases blast radius.");
  } else if (input.maxTransactions > 100) score += 9;

  if (input.durationHours > 72) score += 16;
  else if (input.durationHours > 24) score += 7;

  if (input.cooldownMinutes < 3) {
    score += 20;
    findings.push("Very short cooldown can amplify repeated execution errors.");
    recommendations.push("Use at least a five-minute cooldown during the pilot.");
  } else if (input.cooldownMinutes < 5) score += 8;

  if (input.tokens.length > 4) score += 9;
  if (/flash|leverage|perp|arbitrage|cross-chain/.test(strategy)) {
    score += 18;
    findings.push("Strategy is sensitive to slippage, latency, or leverage.");
    recommendations.push("Require simulation and human review before execution.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW";
  const decision = score >= 80 ? "BLOCK" : score >= 60 ? "REVIEW" : "ALLOW";
  if (!findings.length) findings.push("Policy scope is narrow and time-bounded for a pilot.");
  if (!recommendations.length) recommendations.push("Keep simulation and anomaly alerts enabled.");

  return {
    score,
    level,
    decision,
    summary: decision === "ALLOW" ? "Policy is bounded enough for a monitored Devnet pilot." : decision === "REVIEW" ? "Policy requires human review before signing." : "Policy exceeds the safety envelope and should not be signed.",
    findings,
    recommendations,
    source: "deterministic-fallback",
    model: "redline-rules-v1",
  };
}

const assessmentSchema = {
  type: "object",
  additionalProperties: false,
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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return response(204, {});
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });
  if ((event.body || "").length > 10_000) return response(413, { error: "Payload too large" });

  let parsed;
  try {
    parsed = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON" });
  }

  const input = normalize(parsed);
  const errors = validationErrors(input);
  if (errors.length) return response(400, { error: "Invalid policy", details: errors });

  if (!process.env.OPENAI_API_KEY) {
    return response(200, deterministicAssessment(input));
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
    const result = await client.responses.create({
      model,
      store: false,
      max_output_tokens: 700,
      instructions: [
        "You are the REDLINE risk copilot for autonomous DeFi agents on Solana.",
        "Assess only operational risk from the supplied policy. Do not predict profit, give investment advice, or invent market data.",
        "Prefer bounded permissions, short validity windows, simulation, allowlists, and human review for high-impact actions.",
        "A BLOCK verdict is appropriate when cumulative blast radius is unacceptable; REVIEW means explicit human approval is required.",
      ].join(" "),
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "redline_agent_risk_assessment",
          strict: true,
          schema: assessmentSchema,
        },
      },
    });

    const assessment = JSON.parse(result.output_text);
    return response(200, { ...assessment, source: "openai", model });
  } catch {
    return response(200, deterministicAssessment(input));
  }
}
