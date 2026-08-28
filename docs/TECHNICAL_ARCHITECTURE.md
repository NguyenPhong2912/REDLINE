# Technical architecture — REDLINE

Status: deployed on Solana Devnet. Program `Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4`; backend, Postgres and dashboard all on Render from the repo's `render.yaml` blueprint. Every number below is verifiable on Solana Explorer.

## The one-line design

The off-chain runtime may **propose**; only the on-chain program can **move funds** — and it moves them only after seven checks. A rejected intent is a failed transaction with a custom error and zero token movement.

```text
Browser (React + Wallet Standard)
  ├─ owner signs init_vault / create_grant / revoke_grant / withdraw ──► Solana Devnet
  └─ reads grants, intents, audit; SSE live feed ◄──────────────────── REDLINE API
                                                                          │
REDLINE API (Fastify · Prisma · Postgres)                                 │
  ├─ policy engine: off-chain mirror of the 7 gates (advisory only)       │
  ├─ agent runtime: scripted / LLM planner → intent → execute_transfer ──► program
  ├─ indexer: logsNotifications → Anchor events → audit + counters ◄────── program logs
  └─ audit trail: append-only, every row carries a signature when one exists

Solana program `redline_guardrails` (Anchor)
  ├─ Vault PDA ["vault", owner]          holds SPL tokens; only the program can sign out
  ├─ Grant PDA ["grant", owner, agent_id] limits + counters + allowlists
  └─ execute_transfer: gates → CPI spl_token::transfer → counters, atomically
```

## On-chain program

Source: `programs/redline_guardrails/src/lib.rs` (Anchor 0.32, built and deployed via Solana Playground; IDL checked in at `backend/idl/redline_guardrails.json`).

| Instruction | Signer | Effect |
|---|---|---|
| `init_vault` | owner | creates the Vault PDA; token accounts are ATAs owned by it |
| `create_grant(agent_id, policy_hash, cap, max_tx, expires_at, cooldown, allowed_mints[≤4], allowed_destinations[≤4])` | owner | creates the Grant PDA bound to one executor key |
| `execute_transfer(nonce, amount)` | executor | the only path that moves funds |
| `revoke_grant` | owner | sets `active = false`; every later transfer fails |
| `withdraw(amount)` | owner | pulls tokens back; no gates — the owner's key is the authority |

Gate order inside `execute_transfer` (first failure returns; nothing below runs):

```rust
require!(grant.active,                                     Revoked);               // 6005
require!(now < grant.expires_at,                           Expired);               // 6006
require!(nonce == grant.next_nonce,                        NonceReplay);           // 6007
require!(grant.allowed_mints.contains(&mint),              MintNotAllowed);        // 6008
require!(grant.allowed_destinations.contains(&dest_owner), DestinationNotAllowed); // 6009
require!(grant.transaction_count < grant.max_transactions, TxCapExceeded);         // 6010
require!(spent + amount <= grant.spend_cap_units,          SpendCapExceeded);      // 6011
require!(now - last_execution_at >= cooldown,              CooldownActive);        // 6012
// counters updated, then CPI transfer signed with the vault PDA seeds — same transaction
```

`PolicyDecision` is emitted only on success; a rejection surfaces as the transaction error, which the explorer shows verbatim (e.g. `custom program error: 0x177b` = 6011).

Reference transaction — an agent trying to move 300 USDC against a remaining budget of 200, rejected on-chain with token balances unchanged:
<https://explorer.solana.com/tx/2FMhtv3C9HjXbgmRaWzU3tMABjo8TvmDPnSiUGMXiDsD4xetWaL2ahRhMAA14WY5zdH2JX7JPtQJfxoG75LWoVYw?cluster=devnet>

## Off-chain services (`backend/`)

TypeScript throughout, sharing one canonical policy hash with the frontend.

- **Chain adapter** (`src/chain/`). `MockChain` runs the identical gate logic in memory so the whole product works without a wallet or RPC; `SolanaChain` sends real transactions. The Anchor wire format (discriminators, Borsh arguments, `Grant` account layout, error codes, events) is hand-encoded in `src/chain/anchor.ts` and pinned by tests — no generated client, no IDL at runtime.
- **Policy engine** (`src/policy/engine.ts`). Same seven gates in the same order, so a precheck reason code always equals the program error the chain would return. It explains rejections and avoids paying for doomed transactions; it is never the authority.
- **Agent runtime** (`src/runtime/`). Scripted planner (3 compliant transfers, then one over cap — the demo story) and an LLM planner (OpenAI, strict JSON schema). The model proposes; every proposal is judged by the program.
- **Indexer** (`src/indexer.ts`). Subscribes to program logs, decodes events, updates mirrored counters and writes audit rows — for our transactions and anyone else's.
- **Audit trail + SSE**. Append-only `audit_event`; the dashboard feed is the same stream an auditor reads back later.
- **Resilience**. Retries with backoff on RPC throttling; a throttled step does not end an agent run. `execute_transfer` is sent with `skipPreflight` on purpose so a rejection lands on-chain as evidence.
- **Access control**. Write routes require a shared API key; owner actions are authorised by the wallet signature the program verifies. Next step for production: sign-in-with-Solana sessions.

## Frontend

React 19 + Vite + `@solana/kit` 8 + Wallet Standard. The wizard builds the policy, runs the AI risk copilot (deterministic floor the model cannot lower), then the wallet signs `create_grant`; the API only records `grantPda` + signature. Active Policy Accounts reads counters from the PDA; the Treasury page shows the live vault balance with owner-signed `withdraw`. Marketplace, analytics, P&L and APY cards remain simulated and are labelled as such.

## Trust boundaries

```text
Owner wallet      the only signer for vault, grant, revoke, withdraw; never leaves the browser
Executor key      lives in the backend; can only call execute_transfer, which the program gates
Backend/DB        proposes and records; cannot move funds outside a grant even if compromised
LLM               advisory input to the runtime; never trusted, never signs
Program           the sole authority over vault funds
```

## Testing

- `backend/test/engine.test.ts` — each gate, cumulative cap, cooldown, gate precedence.
- `backend/test/anchor.test.ts` — discriminators, Borsh encoding, `Grant` layout round-trip, PDAs, error mapping, event decoding.
- `backend/test/onchain.test.ts` — the **deployed Devnet binary** loaded into LiteSVM: 3 allows, nonce replay, spend cap (balance unchanged), foreign destination, wrong signer, revoke. Runs in CI (`.github/workflows/backend-ci.yml`) on Linux; LiteSVM has no Windows build.
- `backend/test/auth.test.ts`, `transient.test.ts` — API key guard, RPC error classification.

## Known limitations

- Adapter v0 is SPL transfer to an allowlisted destination. DEX adapters (Jupiter/Orca) need instruction inspection and are the next milestone; Devnet liquidity makes them impractical to demo today.
- Demo USDC is a Devnet mint we control; `POST /devnet/fund` exists only for demos.
- Public Devnet RPC rate-limits shared cloud IPs; a dedicated RPC (Helius) is configured for the hosted demo.
- The shared API key is a drive-by guard, not authentication. No professional audit has been performed; mainnet use is out of scope.
