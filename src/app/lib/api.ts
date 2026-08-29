// Single place the UI talks to the REDLINE backend. Every page reads through
// these helpers so switching hosts (localhost → Render) is one env change.

// render.yaml injects VITE_API_URL from the API service's RENDER_EXTERNAL_URL,
// which already carries a scheme; tolerate a bare hostname too.
const configuredApi = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
export const API_URL = !configuredApi
  ? "http://localhost:8787"
  : /^https?:\/\//.test(configuredApi) ? configuredApi : `https://${configuredApi}`;
// Shared write key (see backend/src/auth.ts for what it does and does not protect).
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

export interface Health { ok: boolean; chain: "mock" | "solana"; programId: string; executor: string; clockSpeed: number }
export interface AgentVersion { id: string; name: string; version: string; strategy: string; agentHash: string }
export interface OnchainGrant { active: boolean; spentUnits: string; transactionCount: number; nextNonce: number; spendCapUnits: string; maxTransactions: number; cooldownSeconds: number; expiresAt: number; allowedMints: string[]; allowedDestinations: string[] }
export interface Grant {
  id: string; grantPda: string; agentId: string; executorPubkey: string; createSignature: string | null;
  spentUnits: string; transactionCount: number; nextNonce: number; revoked: boolean; createdAt: string; lastExecutionAt: string | null;
  agentVersion: AgentVersion;
  // Present when this grant runs under a marketplace rental.
  hire?: { id: string; endsAt: string; status: string } | null;
  policyVersion: { policyHash: string; spendCapUnits: string; maxTransactions: number; cooldownSeconds: number; expiresAt: string; allowedMints: string; allowedDests: string };
  owner: { wallet: string };
  onchain?: OnchainGrant | null;
  runs?: { id: string; mode: string; status: string; startedAt: string }[];
}
export interface IntentRow {
  id: string; nonce: number; amountUnits: string; destination: string; reason: string; intentHash: string; createdAt: string;
  decision: null | { allow: boolean; reasonCode: string; stage: string; chainTx: null | { signature: string; result: string; error: string | null; slot: string | null } };
}
export interface AuditRow { id: string; createdAt: string; actorType: string; eventType: string; subjectType: string; subjectId: string; chainSignature: string | null; payload: Record<string, unknown> }
export interface VaultView { owner: string; vaultPda: string; vaultAta: string; mint: string; balanceUnits: string | null; exists: boolean }
export interface FeedEvent { id: string; at: string; eventType: string; actorType: string; payload: Record<string, unknown>; chainSignature?: string | null }
export interface Listing {
  id: string; agentVersionId: string; priceLamports: string; developerWallet: string | null; status: string; createdAt: string;
  agentVersion: AgentVersion; activeHires: number;
}
export interface Hire {
  id: string; listingId: string; ownerWallet: string; paymentSignature: string | null; startsAt: string; endsAt: string; status: string;
  listing: Listing;
}
export interface Analytics {
  activeGrants: number; totalGrants: number; totalVolumeUsdc: number; totalTransactions: number; totalRejections: number;
  successRatePct: number | null; avgDecisionLatencyMs: number | null;
  weeklyVolume: { t: string; date: string; volumeUsdc: number }[];
  topAgentsByVolume: { name: string; volumeUsdc: number; grants: number }[];
}

// Wallet session. Kept in localStorage so a reload does not force another
// signature, and sent ahead of the shared key: the key says "some caller",
// a session says which wallet.
const SESSION_KEY = "redline.session";
export interface WalletSession { token: string; wallet: string; expiresAt: string }

export function loadSession(): WalletSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as WalletSession;
    if (!s?.token || !s.wallet || new Date(s.expiresAt) <= new Date()) return null;
    return s;
  } catch {
    return null; // private mode, blocked storage, or a value we did not write
  }
}

export function storeSession(session: WalletSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* a session we cannot persist still works for this page */ }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const session = loadSession();
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(API_KEY ? { "x-redline-key": API_KEY } : {}), ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const body = await res.json() as { error?: string; details?: unknown }; if (body.error) msg = body.error; } catch { /* keep status text */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<Health>("/health"),
  authNonce: (wallet: string) => req<{ nonce: string; message: string; expiresAt: string }>("/auth/nonce", { method: "POST", body: JSON.stringify({ wallet }) }),
  authVerify: (b: { wallet: string; nonce: string; signature: string }) => req<WalletSession>("/auth/verify", { method: "POST", body: JSON.stringify(b) }),
  agents: () => req<AgentVersion[]>("/agents"),
  publishAgent: (a: { name: string; version: string; strategy: string; modelRef: string; codeRef: string; config?: Record<string, unknown> }) =>
    req<{ agent: AgentVersion }>("/agents", { method: "POST", body: JSON.stringify(a) }),
  grants: () => req<Grant[]>("/grants"),
  grant: (id: string) => req<Grant>(`/grants/${id}`),
  createGrant: (b: {
    ownerWallet: string; vaultPda: string; agentVersionId: string; grantPda: string; createSignature: string; agentId: string;
    policy: { agentName: string; strategy: string; tokens: string[]; spendCapUsdc: number; maxTransactions: number; durationHours: number; cooldownMinutes: number; allowedMints: string[]; allowedDestinations: string[] };
    // True when the owner was shown a REVIEW verdict and accepted it. The API
    // recomputes the verdict itself; this only records that the human saw it.
    riskAcknowledged?: boolean;
    // The rental covering this grant, when the agent belongs to someone else.
    // The API re-checks it against the listing, the wallet and the end date.
    hireId?: string;
  }) => req<{ grant: Grant; policyHash: string; chain: string }>("/grants", { method: "POST", body: JSON.stringify(b) }),
  revoke: (id: string, signature?: string) => req<{ ok: boolean; signature: string }>(`/grants/${id}/revoke`, { method: "POST", body: JSON.stringify({ signature }) }),
  intents: (grantId: string) => req<IntentRow[]>(`/grants/${grantId}/intents`),
  submitIntent: (b: { grantId: string; mint: string; amountUnits: string; destination: string; reason?: string; submitEvenIfDenied?: boolean }) =>
    req<{ intentId: string; precheck: { reasonCode: string; message: string }; submitted: boolean; signature?: string; onchainSuccess?: boolean; onchainReason?: string }>("/intents", { method: "POST", body: JSON.stringify(b) }),
  startRun: (grantId: string, mode: "scripted" | "llm" = "scripted") => req<{ id: string }>("/runs", { method: "POST", body: JSON.stringify({ grantId, mode }) }),
  stopRun: (runId: string) => req<{ ok: boolean }>(`/runs/${runId}/stop`, { method: "POST" }),
  audit: (grantId?: string) => req<AuditRow[]>(`/audit${grantId ? `?grant=${grantId}` : ""}`),
  vault: (owner: string) => req<VaultView>(`/vaults/${owner}`),
  fundVault: (ownerWallet: string) => req<{ vaultPda: string; vaultAta: string; signature: string; balance: string }>("/devnet/fund", { method: "POST", body: JSON.stringify({ ownerWallet }) }),
  listings: () => req<Listing[]>("/listings"),
  setListingPrice: (id: string, b: { developerWallet: string; priceLamports: string }) =>
    req<Listing>(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  hires: (wallet?: string) => req<Hire[]>(`/hires${wallet ? `?wallet=${wallet}` : ""}`),
  hire: (b: { listingId: string; ownerWallet: string; durationHours: number; paymentSignature: string }) =>
    req<Hire>("/hires", { method: "POST", body: JSON.stringify(b) }),
  analytics: (owner?: string) => req<Analytics>(`/analytics${owner ? `?owner=${owner}` : ""}`),
};

// Server-sent events. grantId "*" streams every grant.
export function subscribeFeed(grantId: string, onEvent: (e: FeedEvent) => void): () => void {
  const es = new EventSource(`${API_URL}/grants/${encodeURIComponent(grantId)}/feed`);
  const handler = (ev: MessageEvent) => { try { onEvent(JSON.parse(ev.data) as FeedEvent); } catch { /* ignore malformed */ } };
  for (const t of ["grant.created", "grant.revoked", "run.started", "run.ended", "intent.created", "decision.precheck", "tx.confirmed", "tx.rejected", "chain.policy_decision", "chain.grant_revoked", "chain.grant_created", "chain.tx_failed", "agent.published"]) {
    es.addEventListener(t, handler as EventListener);
  }
  return () => es.close();
}

export const fmtUsdc = (units: string | number | bigint, decimals = 6) => (Number(units) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const short = (s: string, n = 4) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
