import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { encodeCreateGrant, encodeExecuteTransfer, encodeInitVault, encodeRevokeGrant, findGrantPda, findVaultPda, decodeGrant, errorCodeToReason } from "../src/chain/anchor.js";

// On-chain gate tests against the real program binary in LiteSVM.
//   npm run program:fetch   # downloads the deployed .so from Devnet
//   npm run test:onchain    # Linux/macOS only — litesvm ships no Windows build
// CI runs this on ubuntu (see .github/workflows/backend-ci.yml).

const SO = "target/deploy/redline_guardrails.so";
const PROGRAM_ID = "Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ATA_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const SYSTEM = "11111111111111111111111111111111";

type Litesvm = typeof import("litesvm");
type Web3 = typeof import("@solana/web3.js");
let svm: InstanceType<Litesvm["LiteSVM"]>;
let lite: Litesvm;
let web3: Web3;
let available = false;

beforeAll(async () => {
  if (process.platform === "win32" || !existsSync(SO)) return;
  try {
    lite = await import("litesvm");
    web3 = await import("@solana/web3.js");
    available = true;
  } catch {
    available = false;
  }
});

const it_ = (name: string, fn: () => Promise<void> | void) => it(name, async () => {
  if (!available) {
    console.warn(`skipped (litesvm unavailable on ${process.platform} or ${SO} missing): ${name}`);
    return;
  }
  await fn();
});

// ── helpers (web3.js because litesvm's API is built around it) ──
function kp() { return web3.Keypair.generate(); }
function pk(s: string) { return new web3.PublicKey(s); }
function ix(programId: string, keys: { pubkey: import("@solana/web3.js").PublicKey; isSigner: boolean; isWritable: boolean }[], data: Uint8Array) {
  return new web3.TransactionInstruction({ programId: pk(programId), keys, data: Buffer.from(data) });
}
function send(instructions: import("@solana/web3.js").TransactionInstruction[], signers: import("@solana/web3.js").Keypair[]) {
  const tx = new web3.Transaction().add(...instructions);
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = signers[0].publicKey;
  tx.sign(...signers);
  return svm.sendTransaction(tx);
}
function customError(result: unknown): number | null {
  const s = JSON.stringify(result, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const m = /custom program error: 0x([0-9a-f]+)/i.exec(s) ?? /"Custom":\s*"?(\d+)/.exec(s);
  return m ? parseInt(m[1], m[1].length > 4 ? 10 : 16) : null;
}
function ata(owner: import("@solana/web3.js").PublicKey, mint: import("@solana/web3.js").PublicKey) {
  return web3.PublicKey.findProgramAddressSync([owner.toBuffer(), pk(TOKEN_PROGRAM).toBuffer(), mint.toBuffer()], pk(ATA_PROGRAM))[0];
}
// Minimal SPL token account image so we don't need the token program's
// initialize instructions: 165 bytes, mint | owner | amount | state=1.
function tokenAccountData(mint: import("@solana/web3.js").PublicKey, owner: import("@solana/web3.js").PublicKey, amount: bigint) {
  const b = Buffer.alloc(165);
  mint.toBuffer().copy(b, 0); owner.toBuffer().copy(b, 32); b.writeBigUInt64LE(amount, 64); b[108] = 1;
  return b;
}
function mintData(authority: import("@solana/web3.js").PublicKey) {
  const b = Buffer.alloc(82);
  b.writeUInt32LE(1, 0); authority.toBuffer().copy(b, 4); b.writeBigUInt64LE(0n, 36); b[44] = 6; b[45] = 1;
  return b;
}

describe("redline_guardrails on LiteSVM (deployed Devnet binary)", () => {
  it_("boots the program and a funded owner", async () => {
    svm = new lite.LiteSVM();
    svm.addProgram(pk(PROGRAM_ID), readFileSync(SO));
    expect(svm.getAccount(pk(PROGRAM_ID))).not.toBeNull();
  });

  it_("enforces the 7 gates and moves nothing on rejection", async () => {
    svm = new lite.LiteSVM();
    svm.addProgram(pk(PROGRAM_ID), readFileSync(SO));
    const owner = kp(), executor = kp(), dest = kp(), mint = kp();
    svm.airdrop(owner.publicKey, 5_000_000_000n);
    svm.airdrop(executor.publicKey, 1_000_000_000n);

    // mint + vault ATA (1000 USDC) + destination ATA, written directly
    const vaultPda = pk((await findVaultPda(PROGRAM_ID, owner.publicKey.toBase58())).address);
    const vaultAta = ata(vaultPda, mint.publicKey), destAta = ata(dest.publicKey, mint.publicKey);
    svm.setAccount(mint.publicKey, { lamports: 1_000_000_000, data: mintData(owner.publicKey), owner: pk(TOKEN_PROGRAM), executable: false });
    svm.setAccount(vaultAta, { lamports: 1_000_000_000, data: tokenAccountData(mint.publicKey, vaultPda, 1_000_000_000n), owner: pk(TOKEN_PROGRAM), executable: false });
    svm.setAccount(destAta, { lamports: 1_000_000_000, data: tokenAccountData(mint.publicKey, dest.publicKey, 0n), owner: pk(TOKEN_PROGRAM), executable: false });

    // init_vault
    let r = send([ix(PROGRAM_ID, [
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      { pubkey: pk(SYSTEM), isSigner: false, isWritable: false },
    ], encodeInitVault())], [owner]);
    expect(customError(r)).toBeNull();

    // create_grant: cap 500, 5 tx, cooldown 0, allow mint + dest
    const agentId = new Uint8Array(16).fill(9);
    const grantPda = pk((await findGrantPda(PROGRAM_ID, owner.publicKey.toBase58(), agentId)).address);
    const now = Number(svm.getClock().unixTimestamp);
    r = send([ix(PROGRAM_ID, [
      { pubkey: grantPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: owner.publicKey, isSigner: true, isWritable: true },
      { pubkey: executor.publicKey, isSigner: false, isWritable: false },
      { pubkey: pk(SYSTEM), isSigner: false, isWritable: false },
    ], encodeCreateGrant({ agentId, policyHash: new Uint8Array(32).fill(1), spendCapUnits: 500_000_000n, maxTransactions: 5, expiresAt: BigInt(now + 3600), cooldownSeconds: 0n, allowedMints: [mint.publicKey.toBase58()], allowedDestinations: [dest.publicKey.toBase58()] }))], [owner]);
    expect(customError(r)).toBeNull();

    const exec = (nonce: bigint, amount: bigint, signer = executor, to = destAta) => send([ix(PROGRAM_ID, [
      { pubkey: grantPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: signer.publicKey, isSigner: true, isWritable: false },
      { pubkey: mint.publicKey, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
      { pubkey: pk(TOKEN_PROGRAM), isSigner: false, isWritable: false },
    ], encodeExecuteTransfer(nonce, amount))], [signer]);
    const vaultBalance = () => Buffer.from(svm.getAccount(vaultAta)!.data).readBigUInt64LE(64);
    const grant = () => decodeGrant(new Uint8Array(svm.getAccount(grantPda)!.data), grantPda.toBase58());

    // 3 × 100 allowed
    for (let n = 0n; n < 3n; n += 1n) expect(customError(exec(n, 100_000_000n))).toBeNull();
    expect(vaultBalance()).toBe(700_000_000n);
    expect(grant().spentUnits).toBe(300_000_000n);

    // gate 3: nonce replay
    expect(errorCodeToReason(customError(exec(1n, 1_000_000n))!).reasonCode).toBe("NONCE_REPLAY");
    // gate 6: spend cap — the demo moment; balance must not move
    expect(errorCodeToReason(customError(exec(3n, 300_000_000n))!).reasonCode).toBe("SPEND_CAP_EXCEEDED");
    expect(vaultBalance()).toBe(700_000_000n);
    expect(grant().nextNonce).toBe(3);
    // gate 5: destination not on allowlist
    const strangerAta = ata(kp().publicKey, mint.publicKey);
    svm.setAccount(strangerAta, { lamports: 1_000_000_000, data: tokenAccountData(mint.publicKey, kp().publicKey, 0n), owner: pk(TOKEN_PROGRAM), executable: false });
    expect(errorCodeToReason(customError(exec(3n, 1_000_000n, executor, strangerAta))!).reasonCode).toBe("DESTINATION_NOT_ALLOWED");
    // wrong signer is rejected by Anchor's has_one before any gate
    expect(customError(exec(3n, 1_000_000n, kp()))).not.toBeNull();

    // gate 1: revoke then execute
    r = send([ix(PROGRAM_ID, [
      { pubkey: grantPda, isSigner: false, isWritable: true },
      { pubkey: owner.publicKey, isSigner: true, isWritable: false },
    ], encodeRevokeGrant())], [owner]);
    expect(customError(r)).toBeNull();
    expect(errorCodeToReason(customError(exec(3n, 1_000_000n))!).reasonCode).toBe("REVOKED");
    expect(vaultBalance()).toBe(700_000_000n);
  });

  it("documents the discriminator the program expects", () => {
    expect(Buffer.from(encodeInitVault()).toString("hex")).toBe(createHash("sha256").update("global:init_vault").digest("hex").slice(0, 16));
  });
});
