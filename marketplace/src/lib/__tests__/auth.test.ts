import {
  createSignableMessage,
  generateKeyPairSigner,
} from "@solana/kit";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createSessionToken,
  createWalletChallenge,
  verifySessionToken,
  verifyWalletChallenge,
} from "@/lib/server/auth";

describe("wallet authentication", () => {
  it("verifies an Ed25519 challenge signature", async () => {
    const signer = await generateKeyPairSigner();
    const challenge = createWalletChallenge(signer.address);
    const [signatures] = await signer.signMessages([
      createSignableMessage(challenge.message),
    ]);
    const signature = signatures[signer.address];

    expect(signature).toBeDefined();
    if (!signature) return;
    const valid = await verifyWalletChallenge(
      signer.address,
      challenge.nonce,
      Buffer.from(signature).toString("base64"),
    );
    expect(valid).toBe(true);
  });

  it("accepts intact session tokens and rejects tampering", async () => {
    const signer = await generateKeyPairSigner();
    const token = createSessionToken(signer.address);

    expect(verifySessionToken(token)).toBe(signer.address);
    expect(verifySessionToken(`${token}tampered`)).toBeUndefined();
  });
});
