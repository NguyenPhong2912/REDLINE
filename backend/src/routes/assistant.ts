import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/client.js";
import { MESSAGES } from "../policy/engine.js";
import { askForJson, isConfigured, modelName } from "../llm-client.js";
import { POLICY_GATES } from "./protocol.js";
import { json } from "./json.js";

// An assistant that can only talk about what this system actually recorded.
//
// The grounding is assembled here, from the database, and handed to the model
// as the entire world it may reason about. It is never asked to recall facts
// about REDLINE, and it is told in the schema that every figure it cites has
// to come from the brief. A model inventing a spend figure on a product whose
// argument is that numbers are verifiable would be worse than no assistant.
//
// With no model configured it still answers, from the same brief, using the
// rules below — the copilot pattern used by /risk-assess. An operator should
// never be blocked because a provider is down.

const Body = z.object({
  question: z.string().trim().min(1).max(400),
  owner: z.string().min(32).max(44).optional(),
});

export interface Grounding {
  scope: "wallet" | "protocol";
  grants: { active: number; total: number; revoked: number; expiringWithinHours: number | null };
  spend: { spentUsdc: number; capUsdc: number; transactions: number };
  decisions: { allowed: number; refused: number; byReason: Record<string, number> };
  gates: { id: number; label: string; detail: string; refusals: number }[];
  reasonCodes: Record<string, string>;
}

async function gather(owner?: string): Promise<Grounding> {
  const grants = await prisma.agentGrant.findMany({
    where: owner ? { owner: { wallet: owner } } : undefined,
    include: { policyVersion: true },
  });
  const grantIds = grants.map(g => g.id);
  const decisions = grantIds.length
    ? await prisma.policyDecision.findMany({
        where: { intent: { grantId: { in: grantIds } } },
        select: { allow: true, reasonCode: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      })
    : [];

  const byReason: Record<string, number> = {};
  for (const d of decisions) {
    if (d.allow) continue;
    byReason[d.reasonCode] = (byReason[d.reasonCode] ?? 0) + 1;
  }

  const now = Date.now();
  const live = grants.filter(g => !g.revoked);
  const soonest = live
    .map(g => g.policyVersion.expiresAt.getTime() - now)
    .filter(ms => ms > 0)
    .sort((a, b) => a - b)[0];

  return {
    scope: owner ? "wallet" : "protocol",
    grants: {
      active: live.length,
      total: grants.length,
      revoked: grants.filter(g => g.revoked).length,
      expiringWithinHours: soonest === undefined ? null : Math.round(soonest / 3_600_000),
    },
    spend: {
      spentUsdc: Number(grants.reduce((s, g) => s + g.spentUnits, 0n)) / 1e6,
      capUsdc: Number(grants.reduce((s, g) => s + g.policyVersion.spendCapUnits, 0n)) / 1e6,
      transactions: grants.reduce((s, g) => s + g.transactionCount, 0),
    },
    decisions: {
      allowed: decisions.filter(d => d.allow).length,
      refused: decisions.filter(d => !d.allow).length,
      byReason,
    },
    gates: POLICY_GATES.map(g => ({
      id: g.id,
      label: g.label,
      detail: g.detail,
      refusals: g.reasonCodes.reduce((s, r) => s + (byReason[r] ?? 0), 0),
    })),
    reasonCodes: MESSAGES,
  };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    suggestions: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["answer", "suggestions"],
};

/** What the rules alone can say — the answer when no model is configured. */
export function withoutModel(g: Grounding, question: string): { answer: string; suggestions: { title: string; detail: string }[] } {
  const busiest = [...g.gates].sort((a, b) => b.refusals - a.refusals)[0];
  const parts = [
    `${g.scope === "wallet" ? "This wallet" : "The protocol"} holds ${g.grants.active} active ${g.grants.active === 1 ? "grant" : "grants"} of ${g.grants.total}.`,
    `${g.decisions.allowed} transfers were allowed and ${g.decisions.refused} refused.`,
  ];
  if (busiest?.refusals) parts.push(`Most refusals came from gate ${busiest.id}, ${busiest.label.toLowerCase()}.`);

  const suggestions: { title: string; detail: string }[] = [];
  if (g.grants.expiringWithinHours !== null && g.grants.expiringWithinHours < 24) {
    suggestions.push({
      title: "A grant expires soon",
      detail: `The next one lapses in about ${g.grants.expiringWithinHours}h. Past that, gate 2 refuses every transfer and the agent stops without an error.`,
    });
  }
  if (busiest?.refusals && busiest.id === 6) {
    suggestions.push({
      title: "The budget envelope is where work is stopping",
      detail: `Gate 6 refused ${busiest.refusals} ${busiest.refusals === 1 ? "transfer" : "transfers"}. Either the cap is tighter than the task needs, or the agent is asking for more than it was meant to.`,
    });
  }
  if (!g.grants.active && g.grants.total) {
    suggestions.push({ title: "No grant is live", detail: "Every grant here is revoked or expired, so nothing can move until a new one is signed." });
  }
  return {
    answer: `${parts.join(" ")} (Answered from recorded figures — no model is configured, so this is a summary rather than a reading of your question: "${question.slice(0, 80)}".)`,
    suggestions,
  };
}

export async function assistantRoutes(app: FastifyInstance) {
  app.post("/assistant", async (req) => {
    const body = Body.parse(req.body);
    const grounding = await gather(body.owner);
    const floor = withoutModel(grounding, body.question);
    if (!isConfigured()) return json({ ...floor, source: "rules", model: "redline-rules-v1", grounding });

    try {
      const answered = await askForJson<{ answer: string; suggestions: { title: string; detail: string }[] }>({
        system: [
          "You are the REDLINE operations assistant for an on-chain agent guardrail system on Solana.",
          "The user's brief below is the ONLY source of fact available to you. Every number you state must appear in it.",
          "If the brief does not contain what was asked, say so plainly and describe what would be needed — never estimate, and never recall figures from elsewhere.",
          "Gates are checked in order and the first failure stops the transfer; a refusal means nothing moved.",
          "Be concise and concrete. Prefer naming the gate and what would change its outcome over general advice.",
        ].join(" "),
        input: { question: body.question, brief: grounding },
        schemaName: "redline_assistant_reply",
        schema,
        maxTokens: 700,
      });
      if (!answered) return json({ ...floor, source: "rules", model: "redline-rules-v1", grounding });
      return json({ ...answered, source: "model", model: modelName(), grounding });
    } catch (err) {
      req.log.warn({ err: err instanceof Error ? err.message : String(err), model: modelName() }, "assistant call failed; answering from recorded figures");
      return json({ ...floor, source: "rules", model: "redline-rules-v1", grounding });
    }
  });
}
