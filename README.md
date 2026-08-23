# REDLINE

> Autonomous finance. Hard limits.

[Live demo](https://csaclab.netlify.app) · [Source repository](https://github.com/anky06-ky/CSaCLAB)

REDLINE is the programmable safety layer for autonomous DeFi agents on Solana. Users define a narrow policy (asset allowlist, spend cap, transaction limit, cooldown, and expiry), run an AI-assisted risk review, and publish a tamper-evident policy digest before authorizing an agent workflow.

## The problem

DeFi automation usually forces users to choose between manual approval for every action and giving a bot dangerously broad wallet access. Teams also struggle to explain what an AI agent was allowed to do after an incident.

REDLINE makes owner-defined limits explicit, time-bounded, reviewable, and independently verifiable.

## Primary users

- Active DeFi users who want automation without handing over unrestricted custody.
- Small crypto funds and DAO treasury operators that need approval gates and audit evidence.
- Agent developers who need a reusable policy layer instead of bespoke wallet permissions.

## What works today

- Solana Wallet Standard discovery and connection on Devnet.
- Live SOL balance reads from the configured RPC.
- A four-step agent policy builder.
- AI risk assessment through a server-side OpenAI Responses API function with strict JSON output.
- Deterministic safety fallback when the AI service is unavailable or unconfigured.
- SHA-256 policy digest publication through the Solana Memo program.
- Solana Explorer link after transaction confirmation.
- An experimental Anchor policy-account scaffold for revocation, expiry, cooldown, spend, and transaction accounting.
- TypeScript strict mode, unit tests, production build, and security documentation.

Analytics, historical transactions, marketplace reviews, P&L, APY, and agent performance cards are clearly marked simulated prototype data. They must not be presented as traction or live financial results.

## Architecture

```text
Browser / React
  ├─ Solana Kit + Wallet Standard ──> Solana Devnet RPC
  ├─ policy builder ────────────────> SHA-256 policy digest
  ├─ risk client ───────────────────> Netlify function
  │                                    ├─ OpenAI Responses API
  │                                    └─ deterministic fallback
  └─ signed memo transaction ───────> Solana Memo program

Anchor program (source scaffold)
  └─ policy PDA: limits, expiry, cooldown, counters, revocation
```

See [technical architecture](docs/TECHNICAL_ARCHITECTURE.md) and [security model](docs/SECURITY.md).

## Local development

Requirements: Node.js 20 or newer.

```bash
npm install --legacy-peer-deps
copy .env.example .env
npm run dev
```

The public Solana Devnet endpoint works for a demo. Configure a dedicated RPC for a stable event deployment.

To enable the AI risk copilot, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Netlify environment variables. Never expose `OPENAI_API_KEY` through a `VITE_` variable.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm run check
```

## Anchor program

The program source is under `programs/redline_guardrails`. The current machine does not include the Solana/Anchor toolchain, so the Rust program is not claimed as deployed. Before deployment:

```bash
anchor keys sync
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

Replace the provisional program ID in `Anchor.toml` through `anchor keys sync`, then wire the generated IDL/client into the frontend.

## Hackathon material

- [Product brief](docs/PRODUCT_BRIEF.md)
- [Business model](docs/BUSINESS_MODEL.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Security and threat model](docs/SECURITY.md)
- [Submission answers](docs/HACKATHON_SUBMISSION.md)
- [Demo script](docs/DEMO_SCRIPT.md)

## Positioning

- Competition track now: **Best Product & Business**
- Technical target: **Best Technical Build** after the custom program is built, tested, and deployed
- Product theme: **AI × Web3**
- Use case: **DeFi & Digital Assets**

**REDLINE** is the boundary an autonomous agent cannot cross: the system can move quickly without receiving unlimited authority over user funds.
