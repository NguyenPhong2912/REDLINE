# REDLINE backend

Off-chain services for REDLINE: REST API, policy engine, agent runtime, log indexer, audit trail and live feed. The chain is the only authority — everything here either *proposes* an action or *records* what the chain decided.

Hosted instance: `https://csaclab-production.up.railway.app` (Railway + Postgres, dedicated Devnet RPC). Program: `Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4`.

```text
React app ──► API (Fastify) ──► Agent Runtime ──► ChainAdapter ──► Solana program
   ▲              │                                    │
   └── SSE feed ──┴──────────── audit_event ◄──────────┴── Indexer (program logs)
```

## Run locally

Requires Node.js 22+ and a Postgres URL (Neon/Railway free tier is fine).

```bash
cd backend
npm install
cp .env.example .env        # set DATABASE_URL; CHAIN=mock needs nothing else
npm run db:push
npm run dev                 # http://localhost:8787
```

Smoke-test the six-beat demo (bash + python on PATH):

```bash
bash scripts/demo.sh
```

Expected: three compliant transfers confirmed, the fourth rejected with `SPEND_CAP_EXCEEDED` and counters unchanged, then `REVOKED` after the owner revokes.

## Chain adapters

| `CHAIN=` | Behaviour |
|---|---|
| `mock` | In-memory program with the same 7 gates and counter updates. Signatures are prefixed `MOCK…`. `MOCK_CLOCK_SPEED=60` makes a 1-minute cooldown pass in 1 second. |
| `solana` | `src/chain/solana.ts` sends real transactions. `execute_transfer` goes out with `skipPreflight` so a rejection lands on-chain as evidence. Retries with backoff on RPC throttling. |

The backend speaks Anchor's wire format without a generated client: `src/chain/anchor.ts` encodes discriminators, Borsh arguments, the `Grant` account layout, error codes and events; `test/anchor.test.ts` pins it. The IDL exported from Solana Playground is in `idl/redline_guardrails.json` for reference.

## Gate order (matches the program)

1 `REVOKED` · 2 `EXPIRED` · 3 `NONCE_REPLAY` · 4 `MINT_NOT_ALLOWED` · 5 `DESTINATION_NOT_ALLOWED` · 6 `TX_CAP_EXCEEDED` / `SPEND_CAP_EXCEEDED` · 7 `COOLDOWN_ACTIVE`

`src/policy/engine.ts` mirrors this order, so a precheck reason code always equals the program error the chain would return (codes 6005–6012).

## API

Reads are public. Writes (`POST`, except `/risk-assess`) require the `x-redline-key` header when `REDLINE_API_KEY` is set — a drive-by guard for a public demo, not authentication; owner actions are authorised by the wallet signature the program verifies.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | chain kind, program id, executor pubkey, build version |
| POST | `/agents` · GET `/agents` | publish / list immutable agent versions (`agent_hash`) |
| POST | `/grants` | record a wallet-signed grant (`grantPda`, `createSignature`, `agentId`, policy) |
| GET | `/grants`, `/grants/:id` | grants with live on-chain state |
| POST | `/grants/:id/revoke` | record an owner-signed `revoke_grant` (signature required on Solana) |
| POST | `/intents/preview` | dry-run the gates; no write, no fee |
| POST | `/intents` | submit one intent; `submitEvenIfDenied: true` forces the on-chain rejection |
| GET | `/grants/:id/intents` | intents with decisions and chain transactions |
| POST | `/runs` · `/runs/:id/stop` | start / stop the agent runtime (`mode: scripted | llm`) |
| GET | `/grants/:id/feed` | server-sent events (`*` = all grants) |
| GET | `/audit?grant=` | append-only audit trail with signatures |
| GET | `/vaults/:owner` | vault PDA, ATA and live balance |
| GET | `/listings` · PATCH `/listings/:id` | marketplace listings; the publisher claims one by setting a payout wallet and a 24h rate (write-once wallet) |
| GET | `/hires` · POST `/hires` | rental agreements; the SOL payment is fetched from Devnet and checked (signer, payee, rate × 24h periods) before the row is written |
| GET | `/analytics?owner=` | volume, allowed/blocked counts and decision latency computed from the audit trail |
| POST | `/devnet/fund` | mint demo USDC into an owner's vault (Devnet only) |
| POST | `/risk-assess` | AI risk copilot with deterministic floor |

Amounts are strings of base units (`"100000000"` = 100 USDC).

## Runtime modes

- `scripted` — 3 transfers of 20 % of cap, then one of 60 % that exceeds the cap and is submitted anyway. The demo story, independent of any LLM.
- `llm` — OpenAI proposes an action under a strict JSON schema; the proposal is clamped to the allowlists and judged by the program like any other intent. Needs `OPENAI_API_KEY`.

## Indexer

With `CHAIN=solana` the server subscribes to `logsNotifications` for the program. Every transaction that mentions it — ours or anyone's — is decoded: `PolicyDecision` events update mirrored counters and become `chain.policy_decision` audit rows; failed transactions become `chain.tx_failed` with the mapped reason code.

## Tests

```bash
npm test                 # 29 tests: gates, wire format, transient errors, API key guard
npm run program:fetch    # download the deployed program binary from Devnet
npm run test:onchain     # LiteSVM: 3 allows, nonce replay, spend cap, foreign destination, wrong signer, revoke
```

`test:onchain` needs Linux/macOS (LiteSVM ships no Windows build) and runs in CI on every push (`.github/workflows/backend-ci.yml`).

## Deploy (Railway)

Root directory `backend`; Node 22 via `.node-version` / `nixpacks.toml`; `npm run build` then `npm start` (`prisma db push` + server). Variables: `DATABASE_URL` (reference the Postgres service), `PORT=8787`, `CHAIN=solana`, `REDLINE_PROGRAM_ID`, `SOLANA_RPC_URL` / `SOLANA_WS_URL` (dedicated RPC), `EXECUTOR_KEYPAIR_PATH` and `DEMO_OWNER_KEYPAIR_PATH` as the JSON byte arrays themselves, `DEMO_USDC_MINT`, `DEMO_OPS_DESTINATION`, `REDLINE_API_KEY`.

## Keys and demo accounts

`npm run devnet:setup` creates the executor and destination keypairs, a demo USDC mint, the vault, and funds it. `executor.json` signs `execute_transfer` and pays its fees. `owner.json` exists only for headless demos and as the demo mint authority; in the product the owner signs in the browser. Never commit keypairs or `.env` (they are gitignored).

## Maintenance

- `npm run db:cleanup` removes intents that never reached a decision (also swept at startup).
- `scripts/withdraw-check.ts` proves the `withdraw` account order against the live program.
