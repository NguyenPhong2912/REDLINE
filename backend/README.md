# REDLINE backend

Off-chain services for REDLINE: REST API, policy engine, agent runtime, log indexer, audit trail and live feed. The chain is the only authority — everything here either *proposes* an action or *records* what the chain decided.

Hosted instance: `https://redline-api-ku3s.onrender.com` (Render web service + Render Postgres, public Devnet RPC). Provisioned from `render.yaml` at the repo root. Program: `Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4`.

```text
React app ──► API (Fastify) ──► Agent Runtime ──► ChainAdapter ──► Solana program
   ▲              │                                    │
   └── SSE feed ──┴──────────── audit_event ◄──────────┴── Indexer (program logs)
```

## Run locally

Requires Node.js 22+ and a Postgres URL (Render/Neon free tier is fine).

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

Reads are public. A write needs either a **wallet session** or the shared key.

A session is the real credential: `POST /auth/nonce` returns a challenge naming the wallet and a one-time nonce, the wallet signs those bytes, and `POST /auth/verify` exchanges the signature for a bearer token. A Solana address *is* an ed25519 public key, so the signature verifies against the address itself. Nonces are single-use and expire in 5 minutes; sessions last 12 hours and are stored as a SHA-256 of the token, never the token.

Routes that act on someone's property require a session and accept nothing else:

- `PATCH /listings/:id` — a listing can only be claimed by the wallet that will be paid for it.
- `POST /runs` and `POST /intents` — both make the executor spend from a grant's vault, so both check the caller owns that grant. Without this the shared key alone would let anyone drive someone else's agent up to its cap.

On a deployment with no `REDLINE_API_KEY` these checks stand down: that configuration has already declared itself local or mock, where writes are open and `scripts/demo.sh` runs without a wallet.

`REDLINE_API_KEY` in `x-redline-key` remains as a fallback for the scripted demo and headless callers. It is a drive-by guard, not authentication: it ships to a public frontend and anyone can read it out of the bundle. Owner actions on-chain are authorised by the wallet signature the program verifies, whatever the API thinks.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | chain kind, program id, executor pubkey, build version |
| POST | `/auth/nonce` · `/auth/verify` | wallet sign-in: issue a challenge, exchange a signature for a session |
| GET | `/auth/me` | the wallet behind the current session |
| POST | `/agents` · GET `/agents` | publish / list immutable agent versions (`agent_hash`) |
| POST | `/grants` | record a wallet-signed grant (`grantPda`, `createSignature`, `agentId`, policy). An agent someone else published and priced needs a live `hireId` covering it |
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
| GET | `/hires` · POST `/hires` | rental agreements; the SOL payment is fetched from Devnet and checked (signer, payee, rate × 24h periods) before the row is written. A grant for a rented agent records which agreement covers it, and is refused once it lapses |
| GET | `/analytics?owner=` | volume, allowed/blocked counts and decision latency computed from the audit trail |
| GET | `/protocol/overview?owner=` | ordered seven-gate catalog, network state and decision/rejection rollup for the live policy visualization |
| POST | `/devnet/fund` | mint demo USDC into an owner's vault (Devnet only) |
| POST | `/risk-assess` | AI risk copilot with deterministic floor |

Amounts are strings of base units (`"100000000"` = 100 USDC).

## Runtime modes

- `scripted` — 3 transfers of 20 % of cap, then one of 60 % that exceeds the cap and is submitted anyway. The demo story, independent of any LLM.
- `llm` — a model proposes an action under a strict JSON schema; the proposal is clamped to the allowlists and judged by the program like any other intent. Needs `OPENAI_API_KEY`.

Both the planner and the risk copilot talk to any OpenAI-compatible chat-completions endpoint (`src/llm-client.ts`). Set `OPENAI_BASE_URL` to point at one — Groq's free tier needs no card — or leave it unset for OpenAI, which has no free tier. `OPENAI_MODEL` must name a model that endpoint serves; when it does not, the call fails and the copilot answers from the deterministic floor, with the reason logged.

## Indexer

With `CHAIN=solana` the server subscribes to `logsNotifications` for the program. Every transaction that mentions it — ours or anyone's — is decoded: `PolicyDecision` events update mirrored counters and become `chain.policy_decision` audit rows; failed transactions become `chain.tx_failed` with the mapped reason code.

A subscription only delivers what happens while it is open, so on every connect the indexer first replays anything recorded on-chain after the newest signature already in the audit trail (`getSignaturesForAddress`, capped at 1,000). A restart, a dropped socket or a host spin-down therefore leaves no hole in the record. Writes are idempotent per signature, so the overlap between the replay and the live stream is free.

## Tests

```bash
npm test                 # 66 tests: gates, wire format, transient errors, auth, risk floor, failure reporting, wallet sign-in, protocol gates
npm run program:fetch    # download the deployed program binary from Devnet
npm run test:onchain     # LiteSVM: 3 allows, nonce replay, spend cap, foreign destination, wrong signer, revoke
```

`test:onchain` needs Linux/macOS (LiteSVM ships no Windows build) and runs in CI on every push (`.github/workflows/backend-ci.yml`).

## Deploy (Render)

`render.yaml` at the repo root provisions this service, its Postgres database and the dashboard together — Render → Blueprints → New Blueprint Instance, point it at this repo.

It sets root directory `backend`, Node 22 via `.node-version`, `npm run build` then `npm start` (`prisma db push` + server), health check on `/health`, and wires `DATABASE_URL` from the database. Render injects `PORT`; do not set it.

Render prompts once for the secrets the blueprint marks `sync: false`: `SOLANA_RPC_URL` / `SOLANA_WS_URL` (the public Devnet endpoint works; a dedicated RPC avoids the throttling that shared cloud IPs attract), `EXECUTOR_KEYPAIR_PATH` and `DEMO_OWNER_KEYPAIR_PATH` as the JSON byte arrays themselves (Render has no persistent disk for a key file), `DEMO_USDC_MINT`, `DEMO_OWNER_WALLET`, `DEMO_VAULT_PDA`, `DEMO_OPS_DESTINATION`, `OPENAI_API_KEY`. `REDLINE_API_KEY` is generated by Render.

`EXECUTOR_KEYPAIR_PATH` must be set before the first deploy: `CHAIN=solana` makes `initChain` throw without it and the service will not boot.

The dashboard needs nothing entered by hand — every `VITE_*` value is pulled from this service with `fromService`, so the API key, program ID and demo accounts cannot drift between the two.

## Keys and demo accounts

`npm run devnet:setup` creates the executor and destination keypairs, a demo USDC mint, the vault, and funds it. `executor.json` signs `execute_transfer` and pays its fees. `owner.json` exists only for headless demos and as the demo mint authority; in the product the owner signs in the browser. Never commit keypairs or `.env` (they are gitignored).

## Maintenance

- `npm run db:cleanup` removes intents that never reached a decision (also swept at startup).
- `scripts/withdraw-check.ts` proves the `withdraw` account order against the live program.
