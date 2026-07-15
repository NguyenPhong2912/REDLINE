import { agents } from "@/lib/mock-data";
import { chatRequestSchema } from "@/lib/schemas";
import {
  generateAgentResponse,
  type RuntimeAgent,
} from "@/lib/server/ai";
import { getSessionAddress } from "@/lib/server/auth";
import {
  consumeRunPayment,
  verifyPrototypePayment,
} from "@/lib/server/solana-access";
import type { Agent } from "@/types";

type RuntimeAccessAgent = RuntimeAgent &
  Pick<Agent, "creator" | "currency" | "price" | "pricingModel">;

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

function allowRequest(identifier: string) {
  const now = Date.now();
  const current = rateLimit.get(identifier);
  if (!current || current.resetAt <= now) {
    rateLimit.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  const identifier =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(identifier)) {
    return Response.json(
      { error: "Too many requests. Try again in one minute." },
      { status: 429 },
    );
  }

  const parsed = chatRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid chat request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const seedAgent = agents.find((item) => item.id === parsed.data.agentId);
  const agent: RuntimeAccessAgent | undefined = seedAgent ??
    (parsed.data.agentContext
      ? {
          name: parsed.data.agentContext.name,
          longDescription: parsed.data.agentContext.description,
          category: parsed.data.agentContext.category,
          capabilities: parsed.data.agentContext.capabilities,
          runtimeMode: parsed.data.agentContext.runtimeMode,
          systemPrompt: parsed.data.agentContext.systemPrompt,
          maxOutputTokens: parsed.data.agentContext.maxOutputTokens,
          creator: {
            id: `wallet-${parsed.data.agentContext.creatorAddress}`,
            name: "Connected creator",
            avatar: "",
            address: parsed.data.agentContext.creatorAddress,
            verified: false,
            agentCount: 1,
            totalEarnings: 0,
            rating: 0,
          },
          pricingModel: parsed.data.agentContext.pricingModel,
          price: parsed.data.agentContext.price,
          currency: parsed.data.agentContext.currency,
        }
      : undefined);
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    let paymentProof: string | undefined;
    if (
      parsed.data.accessMode === "granted" &&
      agent.pricingModel !== "free"
    ) {
      const sessionAddress = getSessionAddress(request);
      if (
        !sessionAddress ||
        !parsed.data.walletAddress ||
        sessionAddress !== parsed.data.walletAddress
      ) {
        return Response.json(
          { error: "A verified wallet session is required" },
          { status: 401 },
        );
      }

      const ownsAgent = sessionAddress === agent.creator.address;
      if (!ownsAgent) {
        paymentProof = parsed.data.accessProof;
        if (
          !paymentProof ||
          !(await verifyPrototypePayment(paymentProof, sessionAddress, agent))
        ) {
          return Response.json(
            { error: "The Devnet access payment could not be verified" },
            { status: 403 },
          );
        }
      }
    }

    const result = await generateAgentResponse(agent, parsed.data.messages, {
      forceDemo: parsed.data.accessMode === "preview",
    });
    if (
      paymentProof &&
      agent.pricingModel === "pay-per-use" &&
      (result.mode === "live" || agent.runtimeMode === "demo")
    ) {
      consumeRunPayment(paymentProof);
    }
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to run this agent",
      },
      { status: 502 },
    );
  }
}
