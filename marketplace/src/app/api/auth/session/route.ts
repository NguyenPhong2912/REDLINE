import { getSessionAddress } from "@/lib/server/auth";

export async function GET(request: Request) {
  const address = getSessionAddress(request);
  return Response.json({
    authenticated: Boolean(address),
    address: address ?? null,
  });
}
