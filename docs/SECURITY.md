# Security and threat model — REDLINE

## Principles

- The wallet remains the only signer.
- AI output is advisory and cannot bypass deterministic or on-chain checks.
- Default permissions are narrow, expiring, and revocable.
- Only a policy digest is public; no prompt, secret, API key, or private strategy is written on-chain.
- Prototype data is labeled and separated from live RPC data.

## Primary threats

| Threat | Control |
|---|---|
| Agent drains treasury | spend cap, transaction cap, allowlist, cooldown, expiry, revocation |
| Prompt injection changes policy | AI cannot sign; canonical user-reviewed policy is hashed after assessment |
| Compromised frontend | wallet displays and approves the final transaction; production requires signed releases and CSP |
| API key exposure | OpenAI key exists only in the serverless environment, never a `VITE_` variable |
| AI provider outage/refusal | deterministic fallback returns a labeled result |
| Replay or policy substitution | canonical SHA-256 digest binds all displayed policy fields |
| Unsafe high-frequency loop | cooldown and transaction counter checked on-chain |
| Misleading metrics | analytics are derived from the audit trail; figures with no source in the system (P&L, APY, win rate, uptime) are not shown at all |
| RPC failure | explicit error states; no fabricated confirmation or signature |

## Current limitations

- Memo publication proves wallet approval of a digest but does not itself enforce execution limits.
- Enforcement requires deployment and integration of the Anchor program.
- Public Devnet RPC is rate-limited and not suitable for production reliability.
- The serverless fallback has no distributed rate limiter yet.
- A professional audit is required before mainnet deployment or custody claims.

## Responsible demo policy

Use Devnet only. Do not ask users to connect a treasury/mainnet wallet. Do not present simulated P&L, APY, reviews, or transaction history as real. Do not promise returns. Show the Explorer proof and explain the enforcement roadmap precisely.
