# Technical architecture — REDLINE

## Components

### React client

- Vite, React 19, TypeScript strict mode.
- Solana Kit, `@solana/react`, Wallet Standard plugin, and Devnet RPC plugin.
- Reads wallet state and SOL balance directly from Solana.
- Creates a canonical policy payload and SHA-256 digest in the browser.
- Publishes the digest with the SPL Memo program after wallet approval.

### Risk service

- Netlify function at `/api/risk-assess`.
- Validates and normalizes input before any model call.
- Uses the OpenAI Responses API with strict JSON Schema output when a server-side key exists.
- Falls back to deterministic safety rules on missing configuration, timeout, refusal, or provider error.
- Returns the source/model so the UI never misrepresents fallback output as AI.

### On-chain guardrail program

The Anchor source models one policy PDA per authority and agent ID. It stores authority, executor, policy digest, spend counters, transaction counters, expiry, cooldown, and revocation state.

Execution receipts are accepted only while the policy is active, unexpired, within cooldown, under spend cap, and under transaction count.

## Trust boundaries

```text
User wallet: owns signing authority and never exposes a private key
Browser: drafts policy; cannot silently sign
Risk service: advisory only; cannot sign or move funds
Solana program: authoritative hard limits after deployment
Agent runtime: untrusted executor constrained by the policy account
```

## Data status

Wallet connection, balance reads, risk requests, digest generation, and Memo publication are implemented. Marketplace, performance, P&L, APY, review, and historical activity datasets are simulated prototype fixtures.

The Anchor program is source-complete but not built or deployed in this workspace because the Solana/Anchor toolchain is unavailable. This distinction must remain explicit in the demo and submission.

## Production next steps

1. Install pinned Solana and Anchor toolchains in CI.
2. Build and run unit/integration tests against LiteSVM or a local validator.
3. Deploy the policy program to Devnet and generate its TypeScript client.
4. Replace Memo-only proof with policy PDA creation while retaining the digest as audit evidence.
5. Add protocol-specific instruction inspection and simulation.
6. Add authenticated organizations, durable audit storage, rate limiting, and observability.
