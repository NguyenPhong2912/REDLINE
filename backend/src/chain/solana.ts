import { readFileSync } from "node:fs";
import {
  AccountRole,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type AccountMeta,
  type AccountSignerMeta,
  type Instruction,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";
import { ASSOCIATED_TOKEN_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getMintToInstruction } from "@solana-program/token";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import type { GrantLimits, GrantState, Intent } from "../policy/types.js";
import type { ChainAdapter, ExecutionResult } from "./adapter.js";
import { decodeGrant, encodeCreateGrant, encodeExecuteTransfer, encodeInitVault, encodeRevokeGrant, errorCodeToReason, extractCustomError, findGrantPda, findVaultPda } from "./anchor.js";

// Real adapter for the deployed redline_guardrails program on Devnet.
//
// Keys: the EXECUTOR key lives here and signs execute_transfer. The OWNER key
// normally lives in the user's browser wallet; DEMO_OWNER_KEYPAIR_PATH lets a
// headless demo sign init_vault / create_grant / revoke server-side.

type Ix = Instruction<string, readonly (AccountMeta | AccountSignerMeta)[]>;

// Public Devnet RPC rate-limits by IP (HTTP 429) and shared cloud egress gets
// hit hard. Retry transient transport errors with backoff so one throttled
// call does not kill an agent run. A dedicated RPC (Helius/QuickNode) makes
// this path rare; it is not a substitute for one.
function isTransient(e: unknown): boolean {
  // SolanaError.context can hold BigInts; a plain JSON.stringify would throw
  // inside the error handler and mask the real failure.
  const safe = (v: unknown) => { try { return JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)); } catch { return ""; } };
  let text = "";
  try { text = e instanceof Error ? `${e.message} ${safe((e as { context?: unknown }).context ?? {})}` : String(e); } catch { return false; }
  return /429|Too Many Requests|8100002|ECONNRESET|ETIMEDOUT|fetch failed|HTTP error \(50[23]\)/i.test(text);
}
export const isTransientChainError = isTransient;

export async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 6): Promise<T> {
  let delay = 1_000;
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts || !isTransient(e)) throw e;
      await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 300)));
      delay = Math.min(delay * 2, 15_000);
      void label;
    }
  }
}

export interface SolanaConfig {
  rpcUrl: string;
  wsUrl: string;
  programId: string;
  executorKeypairPath: string;
  ownerKeypairPath?: string;
}

// Accepts a file path (local dev) or the JSON array itself (cloud env var:
// EXECUTOR_KEYPAIR_PATH='[12,34,...]'). Same 64-byte Solana CLI format.
export function loadKeypair(pathOrJson: string): Promise<KeyPairSigner> {
  const text = pathOrJson.trim().startsWith("[") ? pathOrJson : readFileSync(pathOrJson, "utf8");
  const raw = JSON.parse(text) as number[];
  if (raw.length !== 64) throw new Error("keypair must be a 64-byte JSON array");
  return createKeyPairSignerFromBytes(new Uint8Array(raw));
}

export class SolanaChain implements ChainAdapter {
  readonly kind = "solana" as const;
  readonly programId: string;
  readonly executorPubkey: string;
  readonly rpc;
  readonly rpcSubscriptions;
  private sendAndConfirm;
  private executor: KeyPairSigner;
  private owner: KeyPairSigner | null;

  private constructor(cfg: SolanaConfig, executor: KeyPairSigner, owner: KeyPairSigner | null) {
    this.programId = cfg.programId;
    this.executor = executor;
    this.owner = owner;
    this.executorPubkey = executor.address;
    this.rpc = createSolanaRpc(devnet(cfg.rpcUrl));
    this.rpcSubscriptions = createSolanaRpcSubscriptions(devnet(cfg.wsUrl));
    this.sendAndConfirm = sendAndConfirmTransactionFactory({ rpc: this.rpc, rpcSubscriptions: this.rpcSubscriptions });
  }

  static async create(cfg: SolanaConfig): Promise<SolanaChain> {
    const executor = await loadKeypair(cfg.executorKeypairPath);
    const owner = cfg.ownerKeypairPath ? await loadKeypair(cfg.ownerKeypairPath) : null;
    return new SolanaChain(cfg, executor, owner);
  }

  get ownerSigner(): KeyPairSigner {
    if (!this.owner) throw new Error("No DEMO_OWNER_KEYPAIR_PATH: owner-signed instructions must come from the browser wallet");
    return this.owner;
  }

  // ── low-level send ──
  // skipPreflight=true on purpose for execute_transfer: a rejected intent
  // must land on-chain as a failed transaction so the explorer shows the
  // program saying no. Everything else keeps preflight.
  private async send(ixs: Ix[], feePayer: KeyPairSigner, skipPreflight = false): Promise<{ signature: string; err: unknown; slot?: bigint; logs: string[] }> {
    const { value: blockhash } = await withRetry(() => this.rpc.getLatestBlockhash({ commitment: "confirmed" }).send(), "getLatestBlockhash");
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      m => setTransactionMessageFeePayerSigner(feePayer, m),
      m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      m => appendTransactionMessageInstructions(ixs, m),
    );
    const signed = await signTransactionMessageWithSigners(msg);
    assertIsTransactionWithBlockhashLifetime(signed);
    const signature = getSignatureFromTransaction(signed);
    try {
      await withRetry(() => this.sendAndConfirm(signed, { commitment: "confirmed", skipPreflight }), "sendAndConfirm");
    } catch (e) {
      // A program rejection surfaces here as a confirmed-but-failed tx; read
      // the on-chain result below. Anything else (throttled after retries,
      // blockhash expired) is a real failure.
      if (!skipPreflight || isTransient(e)) throw e;
    }
    const tx = await withRetry(() => this.rpc.getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send(), "getTransaction");
    return { signature: signature as string, err: tx?.meta?.err ?? null, slot: tx?.slot, logs: [...(tx?.meta?.logMessages ?? [])] };
  }

  // ── ChainAdapter ──
  async initVault(): Promise<{ vaultPda: string; signature: string }> {
    const owner = this.ownerSigner;
    const { address: vaultPda } = await findVaultPda(this.programId, owner.address);
    const ix: Ix = {
      programAddress: this.programId as Address,
      accounts: [
        { address: vaultPda as Address, role: AccountRole.WRITABLE },
        { address: owner.address, role: AccountRole.WRITABLE_SIGNER, signer: owner },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: encodeInitVault(),
    };
    const r = await this.send([ix], owner);
    if (r.err) throw new Error(`init_vault failed: ${JSON.stringify(r.err)}`);
    return { vaultPda, signature: r.signature };
  }

  async createGrant(ownerWallet: string, vaultPda: string, agentIdHex: string, limits: GrantLimits, policyHashHex: string) {
    const owner = this.ownerSigner;
    if (owner.address !== ownerWallet) throw new Error("ownerWallet does not match the demo owner keypair");
    const agentId = new Uint8Array(Buffer.from(agentIdHex, "hex"));
    const { address: grantPda } = await findGrantPda(this.programId, ownerWallet, agentId);
    const ix: Ix = {
      programAddress: this.programId as Address,
      accounts: [
        { address: grantPda as Address, role: AccountRole.WRITABLE },
        { address: vaultPda as Address, role: AccountRole.READONLY },
        { address: owner.address, role: AccountRole.WRITABLE_SIGNER, signer: owner },
        { address: this.executorPubkey as Address, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: encodeCreateGrant({
        agentId,
        policyHash: new Uint8Array(Buffer.from(policyHashHex, "hex")),
        spendCapUnits: limits.spendCapUnits,
        maxTransactions: limits.maxTransactions,
        expiresAt: BigInt(limits.expiresAt),
        cooldownSeconds: BigInt(limits.cooldownSeconds),
        allowedMints: limits.allowedMints,
        allowedDestinations: limits.allowedDestinations,
      }),
    };
    const r = await this.send([ix], owner);
    if (r.err) throw new Error(`create_grant failed: ${JSON.stringify(r.err)}`);
    return { grantPda, signature: r.signature };
  }

  async readGrant(grantPda: string): Promise<GrantState | null> {
    const { value } = await withRetry(() => this.rpc.getAccountInfo(grantPda as Address, { encoding: "base64", commitment: "confirmed" }).send(), "getAccountInfo");
    if (!value) return null;
    const data = new Uint8Array(Buffer.from(value.data[0], "base64"));
    return decodeGrant(data, grantPda);
  }

  async executeTransfer(intent: Intent): Promise<ExecutionResult> {
    const grant = await this.readGrant(intent.grantPda);
    if (!grant) return { signature: "", success: false, reasonCode: "REVOKED", error: "grant account not found" };
    const vault = (grant as GrantState & { vault: string }).vault;
    const [vaultAta] = await findAssociatedTokenPda({ mint: intent.mint as Address, owner: vault as Address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const [destAta] = await findAssociatedTokenPda({ mint: intent.mint as Address, owner: intent.destination as Address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const ix: Ix = {
      programAddress: this.programId as Address,
      accounts: [
        { address: intent.grantPda as Address, role: AccountRole.WRITABLE },
        { address: vault as Address, role: AccountRole.READONLY },
        { address: this.executor.address, role: AccountRole.READONLY_SIGNER, signer: this.executor },
        { address: intent.mint as Address, role: AccountRole.READONLY },
        { address: vaultAta, role: AccountRole.WRITABLE },
        { address: destAta, role: AccountRole.WRITABLE },
        { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data: encodeExecuteTransfer(BigInt(intent.nonce), intent.amountUnits),
    };
    const r = await this.send([ix], this.executor, true);
    if (!r.err) return { signature: r.signature, success: true, reasonCode: "OK", slot: r.slot };
    const code = extractCustomError(r.err) ?? extractCustomError(r.logs.join("\n"));
    const mapped = code === null ? null : errorCodeToReason(code);
    return {
      signature: r.signature,
      success: false,
      reasonCode: mapped?.reasonCode ?? "REVOKED",
      error: mapped ? `${mapped.variant} (${code})` : JSON.stringify(r.err),
      slot: r.slot,
    };
  }

  async revokeGrant(grantPda: string) {
    const owner = this.ownerSigner;
    const ix: Ix = {
      programAddress: this.programId as Address,
      accounts: [
        { address: grantPda as Address, role: AccountRole.WRITABLE },
        { address: owner.address, role: AccountRole.READONLY_SIGNER, signer: owner },
      ],
      data: encodeRevokeGrant(),
    };
    const r = await this.send([ix], owner);
    if (r.err) throw new Error(`revoke_grant failed: ${JSON.stringify(r.err)}`);
    return { signature: r.signature };
  }

  // Devnet only: mint demo USDC into the vault of any owner so a browser
  // wallet can demo without touching the mint authority. The server's demo
  // owner keypair is the mint authority created by devnet-setup.
  async fundVault(ownerWallet: string, mint: string, amountUnits: bigint): Promise<{ vaultPda: string; vaultAta: string; signature: string }> {
    const authority = this.ownerSigner;
    const { address: vaultPda } = await findVaultPda(this.programId, ownerWallet);
    const [vaultAta] = await findAssociatedTokenPda({ mint: mint as Address, owner: vaultPda as Address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const r = await this.send([
      getCreateAssociatedTokenIdempotentInstruction({ payer: authority, ata: vaultAta, owner: vaultPda as Address, mint: mint as Address }),
      getMintToInstruction({ mint: mint as Address, token: vaultAta, mintAuthority: authority, amount: amountUnits }),
    ], authority);
    if (r.err) throw new Error(`fund failed: ${JSON.stringify(r.err)}`);
    return { vaultPda, vaultAta, signature: r.signature };
  }

  async tokenBalance(tokenAccount: string): Promise<string> {
    const { value } = await this.rpc.getTokenAccountBalance(tokenAccount as Address).send();
    return value.amount;
  }

  // Used by the indexer to backfill a signature it saw in logs.
  async fetchLogs(signature: string): Promise<{ err: unknown; slot: bigint; logs: string[] } | null> {
    const tx = await this.rpc.getTransaction(signature as Signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send();
    if (!tx) return null;
    return { err: tx.meta?.err ?? null, slot: tx.slot, logs: [...(tx.meta?.logMessages ?? [])] };
  }
}

export { ASSOCIATED_TOKEN_PROGRAM_ADDRESS };
