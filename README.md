# REDLINE

> Autonomous finance. Hard limits.

[Live demo](https://redline-devnet.netlify.app) · [Program on Devnet](https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet) · [A rejected agent transfer](https://explorer.solana.com/tx/2FMhtv3C9HjXbgmRaWzU3tMABjo8TvmDPnSiUGMXiDsD4xetWaL2ahRhMAA14WY5zdH2JX7JPtQJfxoG75LWoVYw?cluster=devnet)

REDLINE is the programmable safety layer for autonomous DeFi agents on Solana. An owner defines a narrow policy — asset and destination allowlists, spend cap, transaction cap, cooldown, expiry — signs it once, and a Solana program enforces it on every transfer the agent attempts. The agent proposes; the chain decides.

## The problem

DeFi automation forces a choice between approving every action by hand and giving a bot dangerously broad wallet access. Teams also cannot prove afterwards what an agent was allowed to do, and a compromised server or a prompt-injected model can drain a treasury in one transaction.

## How it works

```text
owner wallet ──signs create_grant──► Vault PDA + Grant PDA (Solana program)
                                            ▲
agent runtime ──execute_transfer(nonce, amount)──┤  7 gates → CPI transfer, or a named error and nothing moves
                                            │
indexer ◄── PolicyDecision events ──────────┘  → append-only audit trail → live dashboard feed
```

1. **Policy builder + AI risk copilot** — the model explains risk; a deterministic rule floor it cannot lower decides ALLOW / REVIEW / BLOCK.
2. **One signature** — the wallet signs `create_grant`. Funds sit in a program-owned vault; the backend never holds the owner's key.
3. **Bounded execution** — the runtime (scripted or LLM-planned) sends `execute_transfer`. The program checks revoked → expiry → nonce → mint allowlist → destination allowlist → transaction cap → spend cap → cooldown, then transfers via CPI and updates counters in the same transaction.
4. **Evidence** — every proposal, decision and signature is written to an append-only audit trail; an indexer reads the program's own events so dashboard numbers come from the chain, not the server.
5. **Owner control** — revoke or withdraw at any time from the wallet.

## What is real today

| | Status |
|---|---|
| Program `redline_guardrails` (vault PDA, gated `execute_transfer`, revoke, withdraw, events, error codes) | Deployed on Devnet |
| Wallet-signed vault / grant / revoke / withdraw from the browser | Live |
| Agent runtime, policy engine, indexer, audit trail, SSE feed | Live on Railway + Postgres |
| On-chain gate tests against the deployed binary (LiteSVM) | CI on every push |
| Marketplace, analytics, P&L, APY panels | Simulated, labelled |

See [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) for the design and [docs/HACKATHON_SUBMISSION.md](docs/HACKATHON_SUBMISSION.md) for the submission.

## Repository layout

```text
programs/redline_guardrails   Anchor program (Rust)
backend/                      API, policy engine, agent runtime, indexer, tests — see backend/README.md
src/                          React dashboard (Vite, @solana/kit, Wallet Standard)
docs/                         product, business, architecture, security, submission
```

## Run the dashboard locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env        # VITE_API_URL etc. — see backend/README.md for the values
npm run dev                 # http://localhost:5173
```

Point `VITE_API_URL` at the hosted backend or at a local one (`cd backend && npm run dev`). With `CHAIN=mock` on the backend the whole flow runs without a wallet or RPC.

## Quality checks

```bash
npm run typecheck && npm test && npm run build     # dashboard
cd backend && npm run typecheck && npm test        # backend (29 tests)
cd backend && npm run program:fetch && npm run test:onchain   # LiteSVM gate tests (Linux/macOS)
```

## Demo in four minutes

1. Connect a Devnet wallet. Guardrails → wizard → risk assessment → **Sign & create on-chain grant** (cap 500 USDC, 5 tx).
2. **Start agent (scripted)**. Dashboard feed: three transfers confirmed on-chain, counters rising on the PDA.
3. The fourth transfer exceeds the cap. The feed shows `on-chain REJECT · SPEND_CAP_EXCEEDED · nothing moved` with an explorer link; token balances before/after are identical.
4. **Revoke** from the wallet; the next attempt fails with `Revoked`. Treasury → **Withdraw**.

## Team

CSaCLAB — Trần An Kỳ, Nguyễn Thành Phong, Nguyễn Hà Thu, Trần Hoàng Thông, Trịnh Ngọc Minh Nhật. Tracks: Best Technical Build and Best Product & Business. Theme: AI × Web3 · DeFi & Digital Assets.

Devnet only. No returns are promised; simulated panels are labelled; no professional audit has been performed.
