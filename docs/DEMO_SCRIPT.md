# Three-minute demo script

Everything below is live on Devnet. Nothing on screen is a fixture.

**Before you present.** The API sleeps after ~15 minutes idle on Render's free tier and takes about a minute to wake, so open `https://redline-api-ku3s.onrender.com/health` a few minutes early and leave the dashboard loaded. Have a Devnet wallet connected with a little SOL for fees. If the vault is empty, Treasury → **Refill 1,000 (devnet)**.

## 0:00–0:20 — The problem

Automating a treasury forces a bad choice: approve every transaction by hand, or hand a bot broad wallet authority and hope. And afterwards nobody can prove what the agent was *allowed* to do — only what it did.

State the claim you are about to demonstrate: REDLINE makes the boundary explicit, and a Solana program — not the agent's good behaviour — enforces it.

## 0:20–0:40 — Connect

Connect a Wallet Standard wallet on Devnet. Show the address and SOL balance, then Treasury: the vault PDA, its balance, and the point that the vault is owned by the program, not by the server.

## 0:40–1:20 — Write the policy

Guardrails → wizard. Pick SOL and USDC, a **500 USDC cap**, 25 transactions, 12-hour expiry, and the **1-minute cooldown** — the shortest the wizard offers. The runtime paces itself to the cooldown so it never trips gate 7, so a long one means long silences on stage.

Run the risk assessment. Show the score, the verdict, and the `source` label. Make the design point: deterministic rules set a floor the model can only raise — a BLOCK verdict disables signing, and the model cannot argue a policy down. With no API key configured it answers from those rules alone, so the copilot cannot become a dependency.

## 1:20–1:40 — Sign it on-chain

**Sign & create on-chain grant.** The wallet signs `create_grant`; the backend only records the resulting PDA and signature. Say plainly: the owner's key never leaves the browser, and the server has no authority to widen this policy afterwards.

## 1:40–2:20 — The moment that matters

**Start agent (scripted).** The first transfer confirms on-chain within seconds; point at the counters rising on the PDA. Say what happens next: the agent now waits out its cooldown before proposing again, because the runtime paces itself rather than letting the chain reject it for going too fast.

Do not wait for that. Hit **Force `<cap>` USDC (over cap)** — an intent deliberately larger than the remaining budget. The feed shows:

```
on-chain REJECT · SPEND_CAP_EXCEEDED · nothing moved
```

Open the Explorer link. The transaction is *on-chain and failed* — `custom program error: 0x177b` (6011) — and the token balances before and after are identical. That is the whole product in one screen: the agent asked, the chain refused, and the refusal is public.

The spend cap is gate 6 and the cooldown is gate 7, so this rejection lands on the cap no matter how the cooldown is set. It is the one beat that cannot go wrong on timing.

Reference, if the live run is slow: [the rejection](https://explorer.solana.com/tx/5wK3Cp6gY3Ayymwwnnjiptbhq8St5MWwKcJ7d3qRtYy12VWHkR5yfm3JkCCrTtwjh71AtuexJWtSRbYYZtaGB5MC?cluster=devnet).

## 2:20–2:40 — The owner stays in control

**Revoke** from the wallet — the next attempt fails with `Revoked`. Then Treasury → **Withdraw**: no gates apply, because the owner's key is the authority. Show the Audit page: every proposal, decision and signature, appended, with the indexer's own record read back from the program's logs rather than from the server's memory.

## 2:40–3:00 — Close

What is real today: the Anchor program on Devnet, wallet-signed grants, seven gates enforced on every transfer, an audit trail sourced from chain events, marketplace rentals whose SOL payment is verified against the chain, and analytics computed from the trail. P&L and APY are absent on purpose — the system has no price feed, so there is no honest number to show.

Where it goes: treasury teams first, subscription plus marketplace fee. The next technical milestone is DEX adapters with instruction inspection, so agents can trade inside a policy rather than only transfer.

Be direct about scope: Devnet only, no professional audit yet.
