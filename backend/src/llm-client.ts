import OpenAI from "openai";

// One way to ask a model for JSON that matches a schema.
//
// Chat Completions, not the Responses API: Responses is OpenAI's own surface,
// while every OpenAI-compatible provider implements /v1/chat/completions. That
// matters because OpenAI has no free tier — Groq, OpenRouter and Google AI
// Studio do — and a copilot the operator cannot afford to switch on is a
// copilot that never runs.
//
// Point it anywhere with OPENAI_BASE_URL:
//   Groq    https://api.groq.com/openai/v1
//   OpenAI  unset
//
// Returns null when nothing is configured, so callers keep their fallback.

export interface JsonModelRequest {
  system: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export function modelName(): string {
  return process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

export function isConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function askForJson<T>(req: JsonModelRequest): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
  const completion = await client.chat.completions.create({
    model: modelName(),
    max_completion_tokens: req.maxTokens,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: JSON.stringify(req.input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: req.schemaName, strict: true, schema: req.schema },
    },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("model returned no content");
  return JSON.parse(text) as T;
}
