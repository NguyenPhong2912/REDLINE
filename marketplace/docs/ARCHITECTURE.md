# AgentX Architecture

## Design Goal

AgentX separates expensive or private AI execution from small, auditable on-chain ownership and settlement records. The program does not run an LLM. It records who published an agent, which metadata digest defines it, how access is priced, and whether a buyer has a valid grant.

## PDA Model

| Account | Seeds | Responsibility |
| --- | --- | --- |
| Marketplace config | `marketplace` | Authority, treasury, and fee basis points. |
| Agent listing | `agent`, creator pubkey, SHA-256 agent ID | Creator ownership, metadata hash, price, pricing model, status, and counters. |
| Access grant | `access`, listing pubkey, buyer pubkey | Permanent access, expiry, run credits, and usage counters. |

The TypeScript helpers in `src/lib/solana/marketplace.ts` use the same seeds as the Rust program.

## Instructions

- `initialize_marketplace`: creates the singleton config PDA.
- `update_marketplace`: rotates authority or treasury and changes the fee within a 10% cap.
- `register_agent`: creates a creator-owned listing PDA.
- `update_agent`: changes metadata, pricing, or active status under creator authority.
- `purchase_access`: splits native SOL between creator and treasury, then updates the access grant atomically.
- `consume_access`: validates permanent or timed access and decrements a per-run credit when required.

## Trust Boundaries

### Browser

The browser is untrusted. Paid prototype runs establish a short-lived wallet session by verifying an Ed25519 challenge, then submit the Devnet payment signature for RPC verification. Production authorization must read the deployed access PDA instead of trusting local state.

### Route Handlers

Routes hold provider credentials and enforce request size, shape, rate limits, wallet sessions, payment proofs, and safety instructions. They do not receive private wallet material. The current in-memory limiter and run-proof replay set must be replaced by shared infrastructure for multiple instances.

### Anchor Program

The program is the intended settlement and authorization source. Account seeds, signer constraints, checked arithmetic, fee caps, treasury validation, listing status, expiration, and credit balances are enforced on-chain.

## Devnet Deployment

The executable program, uploaded IDL, and singleton marketplace config are live on Devnet. The checked-in deployment record contains their public addresses, finalized transaction signatures, slots, and IDL checksum. Deployment and treasury keypairs remain outside the repository.

## Prototype Gap

The current UI uses a direct Devnet SOL transfer and writes the access grant to persisted browser state. This keeps the demo usable while client integration with the deployed program is completed, but it has two known limitations:

1. Payment and grant creation are not atomic.
2. A local grant is not authoritative across devices or servers.

Purchase and consume calls should now be generated from the reviewed IDL, and `/api/ai/chat` should verify the access PDA plus a short-lived signed wallet session.

## Scale Path

Completed: deploy the program, upload its IDL, and initialize the marketplace on Devnet.

1. Replace direct transfers with `purchase_access` transactions.
2. Read access PDAs in the server authorization path.
3. Move metadata JSON to durable object storage or IPFS and anchor its digest.
4. Add SPL token settlement through Token-2022 interfaces.
5. Index events for creator analytics and marketplace search.
6. Move rate limits and run accounting to shared infrastructure.
