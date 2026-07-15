import "server-only";

import type { Agent } from "@/types";

type ParsedTransaction = {
  blockTime: number | null;
  meta: { err: unknown } | null;
  transaction: {
    message: {
      accountKeys: Array<
        | string
        | { pubkey?: string; signer?: boolean; writable?: boolean }
      >;
      instructions: Array<{
        program?: string;
        parsed?: {
          type?: string;
          info?: {
            source?: string;
            destination?: string;
            lamports?: number;
          };
        };
      }>;
    };
  };
};

type VerifiedPayment = {
  buyer: string;
  creator: string;
  lamports: number;
  blockTime: number;
};

const paymentCache = new Map<string, VerifiedPayment>();
const consumedRunPayments = new Set<string>();

async function fetchPayment(signature: string) {
  const cached = paymentCache.get(signature);
  if (cached) return cached;

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.devnet.solana.com";
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as {
    result?: ParsedTransaction | null;
  };
  const transaction = body.result;
  if (!transaction || !transaction.meta || transaction.meta.err !== null) {
    return undefined;
  }

  const transferInstruction = transaction.transaction.message.instructions.find(
    (instruction) =>
      instruction.program === "system" &&
      instruction.parsed?.type === "transfer" &&
      typeof instruction.parsed.info?.source === "string" &&
      typeof instruction.parsed.info.destination === "string" &&
      typeof instruction.parsed.info.lamports === "number",
  );
  const transfer = transferInstruction?.parsed?.info;
  if (
    !transfer?.source ||
    !transfer.destination ||
    typeof transfer.lamports !== "number" ||
    !transaction.blockTime
  ) {
    return undefined;
  }

  const sourceSigned = transaction.transaction.message.accountKeys.some((key) =>
    typeof key === "string"
      ? false
      : key.pubkey === transfer.source && key.signer === true,
  );
  if (!sourceSigned) return undefined;

  const payment = {
    buyer: transfer.source,
    creator: transfer.destination,
    lamports: transfer.lamports,
    blockTime: transaction.blockTime,
  };
  paymentCache.set(signature, payment);
  return payment;
}

export async function verifyPrototypePayment(
  signature: string,
  buyer: string,
  agent: Pick<Agent, "creator" | "currency" | "price" | "pricingModel">,
) {
  if (agent.currency !== "SOL" || agent.price <= 0) return false;
  if (
    agent.pricingModel === "pay-per-use" &&
    consumedRunPayments.has(signature)
  ) {
    return false;
  }

  const payment = await fetchPayment(signature);
  if (!payment) return false;
  const expectedLamports = Math.round(agent.price * 1_000_000_000);
  if (
    payment.buyer !== buyer ||
    payment.creator !== agent.creator.address ||
    payment.lamports < expectedLamports
  ) {
    return false;
  }

  if (agent.pricingModel === "subscription") {
    const ageSeconds = Date.now() / 1_000 - payment.blockTime;
    if (ageSeconds > 30 * 24 * 60 * 60) return false;
  }
  return true;
}

export function consumeRunPayment(signature: string) {
  consumedRunPayments.add(signature);
}
