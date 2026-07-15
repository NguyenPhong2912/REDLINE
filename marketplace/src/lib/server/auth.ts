import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getBase58Encoder } from "@solana/kit";

const CHALLENGE_TTL_MS = 5 * 60 * 1_000;
const SESSION_TTL_SECONDS = 15 * 60;
const SESSION_COOKIE = "agentx_session";
const sessionSecret =
  process.env.AUTH_SECRET ?? randomBytes(32).toString("base64url");
const challenges = new Map<
  string,
  { address: string; message: string; expiresAt: number }
>();
const base58Encoder = getBase58Encoder();

export function createWalletChallenge(address: string) {
  const nonce = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const message = [
    "AgentX wallet authentication",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
    "",
    "This signature does not authorize a transaction or transfer funds.",
  ].join("\n");

  challenges.set(nonce, {
    address,
    message,
    expiresAt: expiresAt.getTime(),
  });
  return { nonce, message, expiresAt: expiresAt.toISOString() };
}

export async function verifyWalletChallenge(
  address: string,
  nonce: string,
  signatureBase64: string,
) {
  const challenge = challenges.get(nonce);
  challenges.delete(nonce);
  if (
    !challenge ||
    challenge.address !== address ||
    challenge.expiresAt <= Date.now()
  ) {
    return false;
  }

  try {
    const publicKeyBytes = new Uint8Array(base58Encoder.encode(address));
    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      publicKey,
      Buffer.from(signatureBase64, "base64"),
      new TextEncoder().encode(challenge.message),
    );
  } catch {
    return false;
  }
}

function sessionSignature(payload: string) {
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

export function createSessionToken(address: string) {
  const payload = Buffer.from(
    JSON.stringify({
      address,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1_000,
    }),
  ).toString("base64url");
  return `${payload}.${sessionSignature(payload)}`;
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return undefined;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return undefined;
  const expectedSignature = sessionSignature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { address?: unknown; expiresAt?: unknown };
    if (
      typeof parsed.address !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Date.now()
    ) {
      return undefined;
    }
    return parsed.address;
  } catch {
    return undefined;
  }
}

export function getSessionAddress(request: Request) {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const sessionCookie = cookies
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  const token = sessionCookie
    ? decodeURIComponent(sessionCookie.slice(SESSION_COOKIE.length + 1))
    : undefined;
  return verifySessionToken(token);
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}
