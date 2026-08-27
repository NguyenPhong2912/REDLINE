<div align="center">

# 🛡️ REDLINE

### ⚡ Autonomous finance. Hard limits.

REDLINE is the **programmable safety layer** for autonomous DeFi agents on Solana.
The agent proposes; **the chain decides**.

[![Backend CI](https://img.shields.io/github/actions/workflow/status/anky06-ky/CSaCLAB/backend-ci.yml?branch=main&label=CI&style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/anky06-ky/CSaCLAB/actions/workflows/backend-ci.yml)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-Rust-14F195?style=for-the-badge&logo=rust&logoColor=white)](programs/redline_guardrails)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white)](src)

**🔗 [Live Demo](https://redline-devnet.netlify.app)** &nbsp;•&nbsp;
**⛓️ [Program on Devnet](https://explorer.solana.com/address/Fj7MV8Z2a3RdH4W8VF2XKfWAsWHT3jxhoqGMcmb4WbS4?cluster=devnet)** &nbsp;•&nbsp;
**🚫 [A Rejected Agent Transfer](https://explorer.solana.com/tx/2FMhtv3C9HjXbgmRaWzU3tMABjo8TvmDPnSiUGMXiDsD4xetWaL2ahRhMAA14WY5zdH2JX7JPtQJfxoG75LWoVYw?cluster=devnet)**

<br>

| [📘 README](README.md) | [🔐 Security](docs/SECURITY.md) | [🛠️ Hướng dẫn cài đặt & sử dụng](docs/USER_GUIDE.md) |
|:---:|:---:|:---:|

</div>

<br>

## 📌 Table of Contents

- [😬 The Problem](#-the-problem)
- [⚙️ How It Works](#️-how-it-works)
- [✅ What Is Real Today](#-what-is-real-today)
- [🗂️ Repository Layout](#️-repository-layout)
- [🚀 Quick Start](#-quick-start)
- [🧪 Quality Checks](#-quality-checks)
- [🎬 Demo In Four Minutes](#-demo-in-four-minutes)
- [👥 Team](#-team)

<br>

## 😬 The Problem

DeFi automation forces a choice between approving every action by hand and giving a bot dangerously broad wallet access. Teams also cannot prove afterwards what an agent was allowed to do, and a compromised server or a prompt-injected model can drain a treasury in one transaction.

> An owner defines a narrow policy — asset and destination allowlists, spend cap, transaction cap, cooldown, expiry — signs it **once**, and a Solana program enforces it on **every** transfer the agent attempts.

<br>

## ⚙️ How It Works

```text
owner wallet ──signs create_grant──► Vault PDA + Grant PDA (Solana program)
                                            ▲
agent runtime ──execute_transfer(nonce, amount)──┤  🚦 7 gates → CPI transfer, or a named error and nothing moves
                                            │
indexer ◄── PolicyDecision events ──────────┘  → 📜 append-only audit trail → 📊 live dashboard feed
```

| Step | | |
|:---:|---|---|
| 🧭 | **Policy builder + AI risk copilot** | The model explains risk; a deterministic rule floor it cannot lower decides `ALLOW` / `REVIEW` / `BLOCK`. |
| ✍️ | **One signature** | The wallet signs `create_grant`. Funds sit in a program-owned vault; the backend never holds the owner's key. |
| 🚧 | **Bounded execution** | The runtime (scripted or LLM-planned) sends `execute_transfer`. The program checks **revoked → expiry → nonce → mint allowlist → destination allowlist → transaction cap → spend cap → cooldown**, then transfers via CPI and updates counters in the same transaction. |
| 🧾 | **Evidence** | Every proposal, decision and signature is written to an append-only audit trail; an indexer reads the program's own events so dashboard numbers come from the chain, not the server. |
| 🔓 | **Owner control** | Revoke or withdraw at any time from the wallet. |

<br>

## ✅ What Is Real Today

| Component | Status |
|---|:---:|
| 🦀 Program `redline_guardrails` (vault PDA, gated `execute_transfer`, revoke, withdraw, events, error codes) | 🟢 **Deployed on Devnet** |
| 👛 Wallet-signed vault / grant / revoke / withdraw from the browser | 🟢 **Live** |
| 🤖 Agent runtime, policy engine, indexer, audit trail, SSE feed | 🟢 **Live on Railway + Postgres** |
| 🧪 On-chain gate tests against the deployed binary (LiteSVM) | 🟢 **CI on every push** |
| 🛍️ Marketplace (publish, claim, rent for real SOL), analytics from the audit trail | 🟢 **Live** |
| 💹 P&L, APY, win-rate panels | ⚪ **Removed — no price feed to compute them honestly** |

📖 See [docs/TECHNICAL_ARCHITECTURE.md](docs/TECHNICAL_ARCHITECTURE.md) for the design and [docs/HACKATHON_SUBMISSION.md](docs/HACKATHON_SUBMISSION.md) for the submission.

<br>

## 🗂️ Repository Layout

```text
programs/redline_guardrails   🦀 Anchor program (Rust)
backend/                      🧠 API, policy engine, agent runtime, indexer, tests — see backend/README.md
src/                          💻 React dashboard (Vite, @solana/kit, Wallet Standard)
docs/                         📚 product, business, architecture, security, submission
```

<br>

## 🚀 Quick Start

> Requires **Node.js 20+**.

```bash
npm install
cp .env.example .env        # VITE_API_URL etc. — see backend/README.md for the values
npm run dev                 # http://localhost:5173
```

Point `VITE_API_URL` at the hosted backend or at a local one (`cd backend && npm run dev`). With `CHAIN=mock` on the backend the whole flow runs without a wallet or RPC.

<br>

## 🧪 Quality Checks

<details>
<summary><strong>💻 Dashboard</strong></summary>

```bash
npm run typecheck && npm test && npm run build
```

</details>

<details>
<summary><strong>🧠 Backend (29 tests)</strong></summary>

```bash
cd backend && npm run typecheck && npm test
```

</details>

<details>
<summary><strong>⛓️ LiteSVM gate tests (Linux/macOS)</strong></summary>

```bash
cd backend && npm run program:fetch && npm run test:onchain
```

</details>

<br>

## 🎬 Demo In Four Minutes

| # | Step |
|:---:|---|
| 1️⃣ | 👛 Connect a Devnet wallet. Guardrails → wizard → risk assessment → **Sign & create on-chain grant** (cap 500 USDC, 5 tx). |
| 2️⃣ | ▶️ **Start agent (scripted)**. Dashboard feed: three transfers confirmed on-chain, counters rising on the PDA. |
| 3️⃣ | 🛑 The fourth transfer exceeds the cap. The feed shows `on-chain REJECT · SPEND_CAP_EXCEEDED · nothing moved` with an explorer link; token balances before/after are identical. |
| 4️⃣ | 🔒 **Revoke** from the wallet; the next attempt fails with `Revoked`. Treasury → **Withdraw**. |

<br>

## 👥 Team

<div align="center">

**CSaCLAB**
Trần An Kỳ · Nguyễn Thành Phong · Nguyễn Hà Thu · Trần Hoàng Thông · Trịnh Ngọc Minh Nhật

🏆 **Tracks:** Best Technical Build · Best Product & Business
🎯 **Theme:** AI × Web3 · DeFi & Digital Assets

---

⚠️ *Devnet only. No returns are promised; simulated panels are labelled; no professional audit has been performed.*

</div>
