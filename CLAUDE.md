# Working rules for AI agents in this repository

> Tóm tắt tiếng Việt: file này là luật cho mọi phiên Claude (hoặc agent khác)
> làm việc trong repo REDLINE. Agent **không bao giờ push**, không sửa thẳng
> `main`, phải chạy đủ kiểm tra trước khi commit, không đưa link/ID phiên chat
> vào commit, và không đụng tới secret hay giao dịch ví thật. Việc đưa code
> lên GitHub (và qua đó lên Render) luôn do người quyết định và thực hiện.

These rules exist because `main` on GitHub auto-deploys to Render (API and
dashboard). Every push is a production deploy of the Devnet demo, so the
push itself is a human decision — and the branch-protection settings at the
end of this file make that a property of the remote, not of anyone's good
behaviour.

## 1. Git

- **Never push.** Not `git push`, not `--force`, not tags, not releases. Leave
  the commits on the local branch and tell the human what to push and why.
- **Never commit on `main` directly.** Create a branch first
  (`claude/<topic>` or `fix/<topic>`), commit there, and describe the change
  so the human can open a pull request. Do not `reset --hard`, rebase, amend
  or otherwise rewrite a branch the human owns without asking first — and
  if a rewrite is approved, leave a `backup/<name>` ref pointing at the old
  head.
- **Commit only when asked.** Finishing a task is not, by itself, permission
  to commit it. When asked, one commit per coherent change, with a message
  that explains *why* — the diff already says *what*.
- **Fetch before you write.** Check `git fetch` + `git status` first; if the
  remote moved, integrate it, never diverge from it.
- **Commit-message hygiene.** No chat-session links or IDs, no tool session
  URLs, no local paths, no wallet addresses beyond the ones already public in
  the repo. A `Co-Authored-By:` trailer naming the model is fine; nothing
  else that identifies a session.
- **Never commit secrets.** `.env`, `backend/.env`, `executor.json`,
  `owner.json`, `*-keypair.json`, `id.json` and any private key material are
  gitignored — keep them that way and never `git add -f` them. If a secret
  was ever printed into a file you created, delete the file and say so.

## 2. Before every commit

Run all of these; a commit is not ready while any of them fails.

```
npm run check                     # frontend: typecheck + vitest + vite build
cd backend && npm run typecheck && npm test
```

If `prisma/schema.prisma` changed, say in the commit message whether
`prisma db push` on the live database is additive (safe) or destructive.
If a route's request or response shape changed, update `backend/README.md`
and the matching type in `src/app/lib/api.ts` in the same commit.

For anything touching auth, ownership checks, redaction, the policy engine,
the chain adapters or the runtime, have the change reviewed (a second agent
pass or a human) before proposing it for merge.

## 3. What an agent must not do here

- Sign, send or simulate-then-send any wallet transaction on behalf of a
  person, on any cluster. Devnet is still someone's keypair.
- Read, print, copy or transmit private keys, `.env` values, session tokens
  or the `x-redline-key` value. Reading `.env.example` is fine.
- Call write routes on the deployed API (`https://redline-api-*.onrender.com`)
  during QA. GET is fine; anything that creates rows, spends or revokes is not.
- Change Render, GitHub, or wallet settings, or store new credentials.

## 4. Codebase notes an agent needs

- Frontend: Vite + React, single-file CSS entry `src/styles/frontend.css`.
  `src/styles/artifact-source.css` is **generated** by
  `scripts/sync-artifact-styles.mjs` from `design/astral-depth/artboards` —
  do not hand-edit it; put overrides in `artifact-responsive.css` or
  `artifact-widgets.css`. Check layouts at 1440, 1920 and 390 px; the
  artboards were drawn at 1440 and absolute sizes have broken past it before.
- Backend: Fastify + Prisma + `@solana/kit`. `src/db/client.ts` constructs
  Prisma lazily on purpose. Tests mock `../src/db/client.js`; new tests that
  touch routes should too.
- Ownership model: every write resolves the caller from a wallet session
  (`backend/src/auth.ts`); never trust a wallet named in a request body.
- Redaction: anything a non-owner reads goes through `backend/src/redact.ts`.
  Signatures stay whole (they are the evidence); addresses and linkage do not.

## 5. Enforcing this on GitHub (for the repository owner)

Rules in a file are advisory. These settings make them mechanical. On
GitHub: **Settings → Branches → Add branch ruleset** (or *Add rule*) for
`main`:

1. **Require a pull request before merging** — at least 1 approval; tick
   *Dismiss stale approvals*.
2. **Require status checks to pass before merging** — select `Backend CI /
   test` and `Frontend CI / check` (both in `.github/workflows/`), and tick
   *Require branches to be up to date*.
3. **Block force pushes** and **Restrict deletions**.
4. **Do not allow bypassing the above settings** — including for admins, so a
   tool acting with your token still cannot push to `main`.
5. Optional but recommended: **Require signed commits**, and in Render turn
   off *Auto-Deploy* for the API service so a merge to `main` deploys the
   dashboard but the API deploy is a deliberate click after the migration
   note in the PR has been read.

Do the one-off history rewrite (removing session links) *before* enabling
rule 3; after that, force-pushing `main` is impossible by design.

Any agent token used with this repository should be a fine-grained token
scoped to *Contents: read* and *Pull requests: write* — enough to open a PR,
not enough to merge or push to `main`.
