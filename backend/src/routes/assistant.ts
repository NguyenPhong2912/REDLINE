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
  // "Active" means the executor could still act on it: not revoked and not
  // past its window. An expired grant counted here told owners an agent was
  // live when gate 2 would refuse everything it proposed.
  const expiryOf = (g: { expiresAt: Date | null; policyVersion: { expiresAt: Date } }) => (g.expiresAt ?? g.policyVersion.expiresAt).getTime();
  const live = grants.filter(g => !g.revoked && expiryOf(g) > now);
  const soonest = live
    .map(g => expiryOf(g) - now)
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

type Suggestion = { title: string; detail: string };

const hasAny = (value: string, terms: string[]) => terms.some(term => value.includes(term));
const isVietnamese = (question: string) =>
  /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(question)
  || hasAny(question.toLowerCase(), [" vì ", " sao ", " của tôi", " bị ", " không ", " nên ", " thế nào"]);

/** Questions with an exact answer in the ledger should never be handed to a model. */
export function isOperationalQuestion(question: string, g: Grounding): boolean {
  const q = ` ${question.toLowerCase().normalize("NFC")} `;
  const mentionsReasonCode = Object.keys(g.reasonCodes).some(reason => question.toUpperCase().includes(reason));
  return mentionsReasonCode || hasAny(q, [
    "agent", "grant", "policy", "gate", "block", "stuck", "refus", "reject", "failed", "failure",
    "budget", "spend", "cap", "usdc", "expire", "expiry", "lapse", "active", "status", "fix", "should",
    "agent", "grant", "chính sách", "gate", "bị chặn", "từ chối", "không chạy", "thất bại", "lỗi",
    "ngân sách", "chi tiêu", "hạn mức", "số dư", "hết hạn", "thời hạn", "hoạt động", "trạng thái", "nên", "sửa", "làm gì",
  ]);
}

function gateAdvice(gateId: number, vi: boolean): Suggestion {
  // Keyed by POLICY_GATES id: 1 active, 2 expiry, 3 nonce, 4 mint,
  // 5 destination, 6 budget, 7 cooldown. Gates 3–5 were once listed in a
  // different order here, so a NONCE_REPLAY spike told the owner to pick
  // another token.
  const advice: Record<number, [string, string, string, string]> = {
    1: ["Restore an active grant", "The grant is revoked or inactive. Review the owner intent and sign a new grant if the agent should run again.", "Khôi phục grant đang hoạt động", "Grant đã bị thu hồi hoặc không còn hoạt động. Hãy kiểm tra ý định của chủ ví và ký grant mới nếu agent cần chạy lại."],
    2: ["Renew the time window", "The grant has expired. Create a new grant with an expiry that covers the intended task window.", "Gia hạn thời gian", "Grant đã hết hạn. Hãy tạo grant mới với thời hạn đủ cho tác vụ dự kiến."],
    4: ["Use an allowed token", "The requested mint is outside the grant allowlist. Choose an allowed mint or review and sign a new policy.", "Dùng token được cho phép", "Mint được yêu cầu không nằm trong allowlist. Hãy chọn mint hợp lệ hoặc rà soát và ký policy mới."],
    5: ["Use an allowed destination", "The recipient is outside the destination allowlist. Correct the address or review a new policy before signing it.", "Dùng địa chỉ được cho phép", "Địa chỉ nhận không nằm trong allowlist. Hãy sửa địa chỉ hoặc rà soát policy mới trước khi ký."],
    3: ["Refresh the transaction state", "The nonce is stale or out of order. Reload the latest grant state before submitting the next transfer.", "Làm mới trạng thái giao dịch", "Nonce đã cũ hoặc sai thứ tự. Hãy tải lại trạng thái grant mới nhất trước khi gửi giao dịch tiếp theo."],
    6: ["The budget envelope is where work is stopping", "Reduce the requested amount, split the task into valid transfers, or sign a reviewed grant with a suitable cap.", "Hạn mức ngân sách đang chặn tác vụ", "Hãy giảm số tiền, chia tác vụ thành các giao dịch hợp lệ, hoặc ký grant mới với hạn mức đã được rà soát."],
    7: ["Respect the cooldown", "Wait for the cooldown to finish or reduce transfer frequency. The agent should not retry continuously.", "Tuân thủ thời gian chờ", "Hãy chờ cooldown kết thúc hoặc giảm tần suất chuyển. Agent không nên thử lại liên tục."],
  };
  const item = advice[gateId] ?? ["Review the failed policy gate", "Inspect the refusal reason and update only the policy field responsible for it.", "Kiểm tra policy gate bị lỗi", "Hãy xem lý do từ chối và chỉ cập nhật trường policy gây ra lỗi."];
  return vi ? { title: item[2], detail: item[3] } : { title: item[0], detail: item[1] };
}

/** Intent-aware fallback used when no model is configured or the provider is unavailable. */
export function withoutModel(g: Grounding, question: string): { answer: string; suggestions: Suggestion[] } {
  const q = ` ${question.toLowerCase().normalize("NFC")} `;
  const vi = isVietnamese(q);
  const busiest = [...g.gates].sort((a, b) => b.refusals - a.refusals)[0];
  const asksBlocked = hasAny(q, ["block", "stuck", "refus", "reject", "failed", "failure", "bị chặn", "từ chối", "không chạy", "thất bại", "lỗi"]);
  const asksBudget = hasAny(q, ["budget", "spend", "cap", "usdc", "ngân sách", "chi tiêu", "hạn mức", "số dư"]);
  const asksExpiry = hasAny(q, ["expire", "expiry", "lapse", "hết hạn", "thời hạn", "bao lâu"]);
  const asksGrant = hasAny(q, ["grant", "policy", "agent", "active", "status", "quyền", "chính sách", "hoạt động", "trạng thái"]);
  const code = Object.keys(g.reasonCodes).find(reason => question.toUpperCase().includes(reason));
  const codeGate = code ? POLICY_GATES.find(gate => (gate.reasonCodes as readonly string[]).includes(code)) : undefined;
  let answer: string;

  if (code) {
    answer = vi
      ? `${code} thuộc gate ${codeGate?.id ?? "?"}${codeGate ? ` (${codeGate.label})` : ""}: ${g.reasonCodes[code]}`
      : `${code} belongs to gate ${codeGate?.id ?? "?"}${codeGate ? ` (${codeGate.label})` : ""}: ${g.reasonCodes[code]}`;
  } else if (asksBlocked) {
    answer = busiest?.refusals
      ? (vi
          ? `Agent bị chặn nhiều nhất tại gate ${busiest.id} (${busiest.label}): ${busiest.refusals} lần từ chối. Tổng cộng có ${g.decisions.allowed} giao dịch được phép và ${g.decisions.refused} giao dịch bị từ chối.`
          : `The agent is blocked most often at gate ${busiest.id}, ${busiest.label.toLowerCase()}: ${busiest.refusals} refusals. In total, ${g.decisions.allowed} transfers were allowed and ${g.decisions.refused} refused.`)
      : (vi ? "Chưa có giao dịch bị từ chối trong dữ liệu hiện tại." : "No refused transfer is recorded in the current data.");
  } else if (asksBudget) {
    answer = vi
      ? `Đã chi ${g.spend.spentUsdc.toLocaleString("vi-VN")} trên tổng hạn mức ${g.spend.capUsdc.toLocaleString("vi-VN")} USDC qua ${g.spend.transactions} giao dịch. Gate 6 sẽ chặn giao dịch làm tổng chi vượt hạn mức.`
      : `${g.spend.spentUsdc.toLocaleString("en-US")} of ${g.spend.capUsdc.toLocaleString("en-US")} USDC has been spent across ${g.spend.transactions} transfers. Gate 6 blocks a transfer that would exceed the total cap.`;
  } else if (asksExpiry) {
    answer = g.grants.expiringWithinHours === null
      ? (vi ? "Không có grant đang hoạt động với thời hạn sắp tới trong dữ liệu hiện tại." : "No active grant with a future expiry is present in the current data.")
      : (vi ? `Grant gần nhất sẽ hết hạn sau khoảng ${g.grants.expiringWithinHours} giờ. Sau thời điểm đó, gate 2 sẽ từ chối mọi giao dịch.` : `The nearest grant expires in about ${g.grants.expiringWithinHours}h. After that, gate 2 refuses every transfer.`);
  } else if (asksGrant) {
    answer = vi
      ? `${g.scope === "wallet" ? "Ví này" : "Giao thức"} có ${g.grants.active} grant đang hoạt động trong tổng số ${g.grants.total}; ${g.grants.revoked} grant đã bị thu hồi. Có ${g.decisions.allowed} giao dịch được phép và ${g.decisions.refused} giao dịch bị từ chối.`
      : `${g.scope === "wallet" ? "This wallet" : "The protocol"} holds ${g.grants.active} active ${g.grants.active === 1 ? "grant" : "grants"} of ${g.grants.total}; ${g.grants.revoked} are revoked. ${g.decisions.allowed} transfers were allowed and ${g.decisions.refused} refused.`;
  } else {
    answer = vi
      ? `${g.scope === "wallet" ? "Ví này" : "Giao thức"} có ${g.grants.active}/${g.grants.total} grant đang hoạt động. ${g.decisions.allowed} giao dịch được phép, ${g.decisions.refused} giao dịch bị từ chối${busiest?.refusals ? `; phần lớn dừng ở gate ${busiest.id} (${busiest.label})` : ""}.`
      : `${g.scope === "wallet" ? "This wallet" : "The protocol"} holds ${g.grants.active} active ${g.grants.active === 1 ? "grant" : "grants"} of ${g.grants.total}. ${g.decisions.allowed} transfers were allowed and ${g.decisions.refused} refused${busiest?.refusals ? `; most stopped at gate ${busiest.id}, ${busiest.label.toLowerCase()}` : ""}.`;
  }

  const suggestions: Suggestion[] = [];
  if (!g.grants.active && g.grants.total) {
    suggestions.push(vi
      ? { title: "Không có grant đang hoạt động", detail: "Mọi grant đều đã bị thu hồi hoặc hết hạn. Cần ký grant mới trước khi agent có thể chuyển tiền." }
      : { title: "No grant is live", detail: "Every grant here is revoked or expired, so nothing can move until a new one is signed." });
  }
  if (g.grants.expiringWithinHours !== null && g.grants.expiringWithinHours < 24) {
    suggestions.push(vi
      ? { title: "Một grant sắp hết hạn", detail: `Grant gần nhất hết hạn sau khoảng ${g.grants.expiringWithinHours} giờ. Hãy rà soát và tạo grant thay thế nếu tác vụ cần tiếp tục.` }
      : { title: "A grant expires soon", detail: `The next one lapses in about ${g.grants.expiringWithinHours}h. Review and replace it if the task must continue.` });
  }
  if (busiest?.refusals) {
    const action = gateAdvice(busiest.id, vi);
    suggestions.push({ ...action, detail: `${vi ? `Gate ${busiest.id} đã từ chối ${busiest.refusals} lần. ` : `Gate ${busiest.id} refused ${busiest.refusals} ${busiest.refusals === 1 ? "transfer" : "transfers"}. `}${action.detail}` });
  }
  return { answer, suggestions: suggestions.slice(0, 3) };
}

export async function assistantRoutes(app: FastifyInstance) {
  app.post("/assistant", async (req) => {
    const body = Body.parse(req.body);
    const grounding = await gather(body.owner);
    const floor = withoutModel(grounding, body.question);
    // Ledger questions have deterministic answers. Keeping them out of the
    // model prevents refusal counts from being relabelled as grant counts and
    // prevents impossible advice such as restoring an immutable revoked grant.
    if (!isConfigured() || isOperationalQuestion(body.question, grounding)) {
      return json({ ...floor, source: "rules", model: "redline-rules-v2", grounding });
    }

    try {
      const answered = await askForJson<{ answer: string; suggestions: { title: string; detail: string }[] }>({
        system: [
          "You are the REDLINE operations assistant for an on-chain agent guardrail system on Solana.",
          "The user's brief below is the ONLY source of fact available to you. Every number you state must appear in it.",
          "The verified baseline is computed directly from the ledger. Do not contradict it, relabel its counts, or invent a limit from an unrelated number.",
          "If the brief does not contain what was asked, say so plainly and describe what would be needed — never estimate, and never recall figures from elsewhere.",
          "Gates are checked in order and the first failure stops the transfer; a refusal means nothing moved.",
          "A grant and its limits are immutable after signing. A revoked or expired grant cannot be restored or edited; the owner must review and sign a new grant.",
          "Answer in the same language as the user's question, including Vietnamese.",
          "Infer the user's intent from natural language, answer it directly, and give up to three concrete next actions.",
          "Prefer naming the gate, reason code, and policy field that would change the outcome over general advice.",
        ].join(" "),
        input: { question: body.question, brief: grounding, verifiedBaseline: floor },
        schemaName: "redline_assistant_reply",
        schema,
        maxTokens: 700,
      });
      if (!answered) return json({ ...floor, source: "rules", model: "redline-rules-v2", grounding });
      return json({ ...answered, source: "model", model: modelName(), grounding });
    } catch (err) {
      req.log.warn({ err: err instanceof Error ? err.message : String(err), model: modelName() }, "assistant call failed; answering from recorded figures");
      return json({ ...floor, source: "rules", model: "redline-rules-v2", grounding });
    }
  });
}
