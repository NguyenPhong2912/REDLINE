export async function GET() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ai: {
      mode: aiConfigured ? "live" : "demo",
      model: aiConfigured ? process.env.OPENAI_MODEL ?? "gpt-5.6-luna" : null,
    },
    solana: {
      cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
      customRpc: Boolean(process.env.NEXT_PUBLIC_SOLANA_RPC_URL),
    },
  });
}
