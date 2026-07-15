import { authChallengeSchema } from "@/lib/schemas";
import { createWalletChallenge } from "@/lib/server/auth";

export async function POST(request: Request) {
  const parsed = authChallengeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  return Response.json(createWalletChallenge(parsed.data.address));
}
