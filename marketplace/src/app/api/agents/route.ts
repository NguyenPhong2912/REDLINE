import { agents, MARKETPLACE_PROGRAM_ID } from "@/lib/mock-data";
import { createAgentSchema } from "@/lib/schemas";
import { deriveAgentListingAddress } from "@/lib/solana/marketplace";
import type { Agent } from "@/types";

export async function GET() {
  return Response.json({ agents, source: "seed" });
}

export async function POST(request: Request) {
  const parsed = createAgentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid agent configuration", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const now = new Date().toISOString();
  const id = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
  const [listingAddress] = await deriveAgentListingAddress(
    input.ownerAddress,
    id,
  );
  const metadata = JSON.stringify({
    name: input.name,
    description: input.description,
    category: input.category,
    capabilities: input.capabilities,
    model: input.llmModel,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    systemPromptHash: await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(input.systemPrompt))
      .then((buffer) =>
        Array.from(new Uint8Array(buffer), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      ),
  });
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(metadata),
  );
  const metadataHash = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  const agent: Agent = {
    id,
    name: input.name,
    description: input.description,
    longDescription: input.description,
    category: input.category,
    creator: {
      id: `wallet-${input.ownerAddress}`,
      name: "Connected creator",
      avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${input.ownerAddress}`,
      address: input.ownerAddress,
      verified: false,
      agentCount: 1,
      totalEarnings: 0,
      rating: 0,
    },
    price: input.pricingModel === "free" ? 0 : input.price,
    currency: input.currency,
    pricingModel: input.pricingModel,
    chain: "solana",
    cluster: "devnet",
    status: "draft",
    auditStatus: "pending",
    verifiedOnChain: false,
    rating: 0,
    reviewCount: 0,
    totalUsers: 0,
    totalTransactions: 0,
    roi: 0,
    successRate: 0,
    responseTime: 0,
    image: `https://api.dicebear.com/9.x/shapes/svg?seed=${id}`,
    tags: [input.category, "creator-built", "devnet"],
    capabilities: input.capabilities,
    programId: MARKETPLACE_PROGRAM_ID,
    listingAddress,
    metadataUri: `sha256://${metadataHash}`,
    runtimeMode: input.llmModel === "demo" ? "demo" : "server",
    systemPrompt: input.systemPrompt,
    maxOutputTokens: Math.min(input.maxTokens, 2_000),
    demoPrompts: [
      `What can ${input.name} help me analyze?`,
      "Show a safe example workflow",
      "List the evidence you would need for a live result",
    ],
    createdAt: now,
    updatedAt: now,
    performance: [],
  };

  return Response.json({ agent, metadataHash, mode: "draft" }, { status: 201 });
}
