import { authVerifySchema } from "@/lib/schemas";
import {
  createSessionToken,
  sessionCookie,
  verifyWalletChallenge,
} from "@/lib/server/auth";

export async function POST(request: Request) {
  const parsed = authVerifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid signature payload" }, { status: 400 });
  }

  const valid = await verifyWalletChallenge(
    parsed.data.address,
    parsed.data.nonce,
    parsed.data.signature,
  );
  if (!valid) {
    return Response.json(
      { error: "Wallet signature could not be verified" },
      { status: 401 },
    );
  }

  const token = createSessionToken(parsed.data.address);
  return Response.json(
    { authenticated: true, address: parsed.data.address },
    { headers: { "Set-Cookie": sessionCookie(token) } },
  );
}
