# Product brief — REDLINE

## One sentence

REDLINE lets users deploy autonomous DeFi agents with AI risk review and verifiable owner-defined limits on Solana.

## Problem

Wallet automation has a permission gap. Manual signing does not scale, but unrestricted agent access creates unacceptable custody, operational, and audit risk. Existing dashboards show what agents did; they rarely prove what agents were allowed to do.

## Primary user

The beachhead user is a small crypto fund or DAO treasury operator managing 50,000–2,000,000 USD in on-chain assets with a lean operations team. They want automation for monitoring and routine execution but need explicit controls before delegating authority.

Secondary users are active DeFi traders and agent developers.

## Jobs to be done

1. Define exactly which assets and amount an agent can touch.
2. Limit how often and how long the agent may act.
3. Catch unsafe configurations before signing.
4. Produce evidence that a policy was approved by the wallet owner.
5. Revoke authority quickly without replacing the treasury wallet.

## MVP flow

1. Connect a Solana Wallet Standard wallet on Devnet.
2. Choose an agent strategy and SPL asset allowlist.
3. Set spend, transaction, cooldown, and expiry bounds.
4. Run AI-assisted risk review with deterministic fallback.
5. Block, require review, or allow the configuration.
6. Publish the policy digest to Solana and open the Explorer receipt.

## Why AI is needed

The deterministic engine enforces hard safety rules. The AI layer explains combined operational risks in plain language and recommends safer bounds. It never receives wallet secrets, signs transactions, predicts profit, or overrides a block verdict.

## Success metrics

- Policy creation completion rate.
- Percentage of unsafe policies changed before signing.
- Time from policy draft to approved proof.
- Revocation latency.
- Value and transaction count protected by active policies.
- Paid teams and monthly active treasury operators.

Prototype metrics shown in the UI are simulated and are not success claims.
