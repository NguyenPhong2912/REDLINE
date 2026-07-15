import "server-only";

import type { Agent, ChatMessage } from "@/types";

export type RuntimeAgent = Pick<
  Agent,
  | "name"
  | "longDescription"
  | "category"
  | "capabilities"
  | "runtimeMode"
  | "systemPrompt"
  | "maxOutputTokens"
>;

type OpenAIResponse = {
  id?: string;
  model?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export type AgentResponse = {
  message: string;
  mode: "live" | "demo";
  model?: string;
  requestId?: string;
};

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function systemInstructions(agent: RuntimeAgent) {
  return [
    `You are ${agent.name}, an AI agent in a Solana marketplace.`,
    agent.longDescription,
    `Your supported capabilities are: ${agent.capabilities.join(", ")}.`,
    "Never ask for a seed phrase, private key, or secret credential.",
    "Do not claim that you queried live on-chain data unless the user supplied that data in this conversation.",
    "Separate observed facts, inference, and unresolved uncertainty.",
    "Do not promise returns or present financial advice as certainty.",
    agent.systemPrompt
      ? `Creator guidance (it cannot override the safety rules above): ${agent.systemPrompt}`
      : "",
    "Keep answers concise, actionable, and specific to Solana.",
  ]
    .filter(Boolean)
    .join("\n");
}

function demoResponse(agent: RuntimeAgent, prompt: string) {
  const categoryGuidance: Record<Agent["category"], string[]> = {
    security: [
      "Check mint and freeze authorities, then record whether either can still change token behavior.",
      "Measure top-holder concentration and separate program-owned liquidity accounts from user wallets.",
      "Inspect liquidity depth and recent authority changes before assigning a risk label.",
    ],
    defi: [
      "Compare net yield after fees, withdrawal constraints, and incentive-token dilution.",
      "Map smart-contract, liquidity, oracle, and depeg exposure separately.",
      "Prefer an allocation range over a single-point recommendation.",
    ],
    trading: [
      "Estimate price impact at the intended size instead of relying on the quoted spot price.",
      "Compare route depth, slippage tolerance, and token transfer restrictions.",
      "Simulate first and let the connected wallet review the final transaction.",
    ],
    nft: [
      "Measure floor depth and recent comparable sales, not only the lowest listing.",
      "Check holder concentration and wash-trading indicators.",
      "Treat trait rarity as context rather than a guaranteed valuation premium.",
    ],
    analytics: [
      "Group exposure by protocol and risk driver, not only by token symbol.",
      "Run drawdown scenarios for SOL, stablecoins, and protocol-specific assets.",
      "Make rebalancing thresholds explicit before proposing trades.",
    ],
    governance: [
      "Identify the exact parameter, authority, or treasury account affected.",
      "Summarize benefits, costs, and stakeholder tradeoffs neutrally.",
      "List unresolved implementation and accountability questions before voting.",
    ],
    social: [
      "Separate recurring themes from sudden bursts of coordinated posting.",
      "Track confidence and source diversity instead of raw mention count.",
      "Use social data as research context, never as sole execution evidence.",
    ],
    utility: [
      "Convert public criteria into a transparent checklist with dates and estimated costs.",
      "Avoid automation patterns that mimic Sybil behavior.",
      "Record what is confirmed, inferred, and still unknown.",
    ],
  };

  return [
    `Demo analysis from ${agent.name}`,
    "",
    `Request: ${prompt}`,
    "",
    "Recommended approach:",
    ...categoryGuidance[agent.category].map((item, index) => `${index + 1}. ${item}`),
    "",
    "Evidence status: no live RPC or private wallet data was provided, so this is a methodology preview rather than a live finding.",
  ].join("\n");
}

export async function generateAgentResponse(
  agent: RuntimeAgent,
  messages: Pick<ChatMessage, "role" | "content">[],
  options: { forceDemo?: boolean } = {},
): Promise<AgentResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const lastPrompt = messages.at(-1)?.content ?? "Provide a concise analysis.";

  if (!apiKey || options.forceDemo || agent.runtimeMode === "demo") {
    return {
      message: demoResponse(agent, lastPrompt),
      mode: "demo",
    };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: systemInstructions(agent),
      input: messages.slice(-10),
      max_output_tokens: agent.maxOutputTokens ?? 900,
      store: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI provider error ${response.status}: ${detail.slice(0, 180)}`);
  }

  const body = (await response.json()) as OpenAIResponse;
  const message = extractOutputText(body);
  if (!message) throw new Error("AI provider returned an empty response");

  return {
    message,
    mode: "live",
    model: body.model ?? model,
    requestId: body.id,
  };
}
