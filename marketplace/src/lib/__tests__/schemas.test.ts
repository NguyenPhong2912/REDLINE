import { describe, expect, it } from "vitest";
import { chatRequestSchema, createAgentSchema } from "@/lib/schemas";

const validOwner = "GgBaCs3N6mTQkjgcK6md6JQX7w6fUSp42a8LsLwK5GEx";

describe("createAgentSchema", () => {
  it("accepts a bounded Solana agent configuration", () => {
    const result = createAgentSchema.safeParse({
      name: "Risk Reader",
      description: "Reviews Solana token authorities and holder concentration.",
      category: "security",
      pricingModel: "one-time",
      price: 0.05,
      currency: "SOL",
      llmModel: "server-default",
      temperature: 0.4,
      maxTokens: 900,
      systemPrompt: "Return facts, inferences, and unknowns separately.",
      capabilities: ["Authority checks", "Holder analysis"],
      ownerAddress: validOwner,
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed wallet addresses and oversized prices", () => {
    const result = createAgentSchema.safeParse({
      name: "Risk Reader",
      description: "Reviews Solana token authorities and holder concentration.",
      category: "security",
      pricingModel: "one-time",
      price: 10_001,
      currency: "SOL",
      llmModel: "server-default",
      temperature: 0.4,
      maxTokens: 900,
      systemPrompt: "",
      capabilities: ["Authority checks"],
      ownerAddress: "not-a-solana-wallet",
    });

    expect(result.success).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("parses a creator-built agent context", () => {
    const result = chatRequestSchema.safeParse({
      agentId: "risk-reader-123",
      accessMode: "preview",
      agentContext: {
        name: "Risk Reader",
        description: "Reviews Solana token authorities and holder concentration.",
        category: "security",
        capabilities: ["Authority checks"],
        runtimeMode: "demo",
        maxOutputTokens: 512,
        creatorAddress: validOwner,
        pricingModel: "one-time",
        price: 0.05,
        currency: "SOL",
      },
      messages: [{ role: "user", content: "Review this methodology" }],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accessMode).toBe("preview");
  });
});
