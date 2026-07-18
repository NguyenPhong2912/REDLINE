# AgentX Three-Minute Demo

## 0:00 - Problem And Market

Open the home page.

Say: "Teams can already buy AI output, but they cannot easily inspect what an agent does, who maintains it, or what access they receive after payment. AgentX turns focused Solana workflows into transparent marketplace listings."

Point to the demand, supply, and revenue band. State that all visible metrics are seed data, not claimed traction.

## 0:30 - Buyer Flow

Open Marketplace and select a security or analytics agent.

Show:

- creator identity and listing PDA
- capabilities and evidence boundaries
- one-time, 30-day, per-run, or free access policy
- audit and on-chain verification status

For a signature-free demo, choose the free `DAO Brief` agent and open Playground. For paid access, connect a funded Devnet wallet and approve the transfer only when the presenter is ready.

## 1:15 - Agent Runtime

Use one of the suggested prompts in Playground.

Point out the `Demo` or live model badge. The demo response explicitly states that no live RPC evidence was supplied. Explain that adding `OPENAI_API_KEY` enables server-side Responses API execution without exposing the key to the browser.

## 1:50 - Creator Flow

Open Create Agent.

Show identity, runtime mode, output limits, system guidance, capabilities, and pricing. On the review step, explain that a connected wallet becomes the creator authority and the draft receives a deterministic listing PDA.

Do not create the draft during a timed demo unless a wallet is already connected.

## 2:25 - Technical Depth

Open the Contract tab on an agent detail page, then reference `programs/agentx_marketplace/src/lib.rs`.

Say: "The Anchor program keeps only settlement and access state on-chain. AI execution remains off-chain. Marketplace, listing, and buyer access are deterministic PDAs. Purchase atomically splits fees and issues permanent, timed, or run-credit access."

## 2:50 - Close

Say: "The initial wedge is security, analytics, and protocol operations for Solana teams. Revenue is a configurable settlement fee, while creators choose the access model. The program and marketplace config are live on Devnet; the next milestone is wiring purchases to the program and indexing its events."

## Approval Checklist

- Wallet connection: user approval in the wallet.
- Paid agent: Devnet SOL transfer approval.
- Live AI: local `OPENAI_API_KEY` configuration.
- Program upgrades: funded deployment wallet and explicit approval.
