import { z } from "zod";

export const solanaAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address");

export const createAgentSchema = z.object({
  name: z.string().trim().min(3).max(64),
  description: z.string().trim().min(24).max(600),
  category: z.enum([
    "defi",
    "nft",
    "trading",
    "analytics",
    "security",
    "social",
    "governance",
    "utility",
  ]),
  pricingModel: z.enum(["one-time", "subscription", "pay-per-use", "free"]),
  price: z.number().min(0).max(10_000),
  currency: z.enum(["SOL", "USDC"]),
  llmModel: z.string().trim().min(2).max(80),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(128).max(16_384),
  systemPrompt: z.string().trim().max(8_000),
  capabilities: z.array(z.string().trim().min(2).max(60)).max(12),
  ownerAddress: solanaAddressSchema,
});

export const chatRequestSchema = z.object({
  agentId: z.string().trim().min(2).max(100),
  walletAddress: solanaAddressSchema.optional(),
  accessProof: z
    .string()
    .trim()
    .min(64)
    .max(100)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/)
    .optional(),
  accessMode: z.enum(["preview", "granted"]).default("preview"),
  agentContext: z
    .object({
      name: z.string().trim().min(2).max(64),
      description: z.string().trim().min(12).max(1_200),
      category: z.enum([
        "defi",
        "nft",
        "trading",
        "analytics",
        "security",
        "social",
        "governance",
        "utility",
      ]),
      capabilities: z.array(z.string().trim().min(2).max(60)).max(12),
      runtimeMode: z.enum(["server", "demo"]).default("server"),
      systemPrompt: z.string().trim().max(8_000).optional(),
      maxOutputTokens: z.number().int().min(128).max(2_000).optional(),
      creatorAddress: solanaAddressSchema,
      pricingModel: z.enum(["one-time", "subscription", "pay-per-use", "free"]),
      price: z.number().min(0).max(10_000),
      currency: z.enum(["SOL", "USDC"]),
    })
    .optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4_000),
      }),
    )
    .min(1)
    .max(20),
});

export type CreateAgentPayload = z.infer<typeof createAgentSchema>;
export type ChatRequestPayload = z.infer<typeof chatRequestSchema>;

export const authChallengeSchema = z.object({
  address: solanaAddressSchema,
});

export const authVerifySchema = z.object({
  address: solanaAddressSchema,
  nonce: z.string().uuid(),
  signature: z
    .string()
    .min(80)
    .max(120)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
