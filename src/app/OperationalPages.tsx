import { address } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  ExternalLink,
  Key,
  Lock,
  Network,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RatingBadge, ReviewPanel } from "./components/AgentRating";
import { TransferLane, VoxelCube } from "./components/depth";
import { GrantSignButton } from "./components/GrantSignButton";
import { GrantsPanel } from "./components/GrantsPanel";
import { SolanaWalletControl } from "./components/SolanaWalletControl";
import { VaultPanel } from "./components/VaultPanel";
import { applyPreference, readPreference } from "./frontend/preferences";
import {
  api,
  API_URL,
  checkHealth,
  loadSession,
  short,
  type AgentVersion,
  type AuditRow,
  type Health,
  type Hire,
  type Listing,
} from "./lib/api";
import { useSignedIn } from "./lib/useSignedIn";
import {
  requestRiskAssessment,
  type AgentPolicyInput,
  type RiskAssessment,
} from "./lib/risk-engine";
import type { AppClient } from "./solana/client";
import {
  explorerAddressUrl,
  explorerTransactionUrl,
  isAddressLike,
} from "./solana/client";
import { transferSolInstruction } from "./solana/payments";
import { PROGRAM_ID } from "./solana/redline";
import { color, mono, sans } from "./theme";

// The program's Grant account stores at most four of each.
const MAX_DESTS = 4;
// Used only when nothing has been published yet — the first grant publishes an
// agent version from this, and every later grant names one that already exists.
const FALLBACK_AGENT = {
  name: "YieldGuard Alpha",
  strategy:
    "Risk-bounded DeFi yield optimization with human review for high-impact actions",
};
const DEMO_OPS_DESTINATION = String(
  import.meta.env.VITE_DEMO_OPS_DESTINATION ?? "",
);

/* ── palette ── */
const M = color.primary;
const C = color.info;
const A = color.warn;
const BG = color.bg;

/* ── glass helper ── */
const glass = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: color.surface,
  border: `1px solid ${color.border}`,
  ...extra,
});

const LAMPORTS_PER_SOL = 1_000_000_000;
const fmtSol = (lamports: string) =>
  (Number(lamports) / LAMPORTS_PER_SOL).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });

type MarketSort = "newest" | "rating" | "demand" | "price";
const MARKET_SORTS: [MarketSort, string][] = [
  ["newest", "Newest"],
  ["rating", "Reputation"],
  ["demand", "Most rented"],
  ["price", "Cheapest"],
];

export function MarketplacePage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const wallet = connected ? String(connected.account.address) : "";
  // Renting moves SOL and creates a record in someone's name. The API refuses
  // it without a signature, so the button waits for one rather than offering
  // an action that is going to come back 401.
  const signedIn = useSignedIn(wallet);
  const [sortBy, setSortBy] = useState<MarketSort>("newest");
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [pricedOnly, setPricedOnly] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [priceSol, setPriceSol] = useState("0.05");
  // Per-listing rental length. The price is a 24h rate, so the total scales
  // with the periods covered — the backend charges the same way.
  const [hours, setHours] = useState<Record<string, number>>({});
  const hoursFor = (id: string) => hours[id] ?? 24;
  const periodsFor = (id: string) => Math.ceil(hoursFor(id) / 24);

  // `error` also carries claim/rent failures, so the empty state needs its own
  // flag to tell "the API said no listings" apart from "the API never answered".
  const load = useCallback(async () => {
    try {
      setListings(await api.listings());
      setError("");
      setLoadFailed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  // The publisher claims a listing by naming the wallet that should be paid.
  async function savePrice(listing: Listing) {
    if (!signedIn) return;
    setBusy(listing.id);
    setError("");
    setNotice("");
    try {
      await api.setListingPrice(listing.id, {
        developerWallet: wallet,
        priceLamports: String(Math.round(Number(priceSol) * LAMPORTS_PER_SOL)),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  }

  // Renting is a real SOL transfer to the publisher, then the backend verifies
  // that transaction on Devnet before recording the hire.
  async function rent(listing: Listing) {
    if (!connected?.signer || !signedIn || !listing.developerWallet) return;
    const durationHours = hoursFor(listing.id);
    const total =
      BigInt(listing.priceLamports) * BigInt(Math.ceil(durationHours / 24));
    setBusy(listing.id);
    setError("");
    setNotice("");
    try {
      const result = await client.sendTransaction([
        transferSolInstruction(wallet, listing.developerWallet, total),
      ]);
      const signature = String(result.context.signature);
      await api.hire({
        listingId: listing.id,
        ownerWallet: wallet,
        durationHours,
        paymentSignature: signature,
      });
      setNotice(
        `Rented ${listing.agentVersion.name} for ${durationHours}h · ${short(signature, 6)}`,
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Rental payment was rejected or could not be verified.",
      );
    } finally {
      setBusy("");
    }
  }

  const filtered = listings
    .filter((l) => {
      if (pricedOnly && Number(l.priceLamports) === 0) return false;
      if (
        search &&
        !`${l.agentVersion.name} ${l.agentVersion.strategy}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      // An unrated agent sorts last rather than first: `null` means "no
      // evidence yet", and treating that as zero would rank a brand-new
      // listing below a demonstrably bad one, which is not the same claim.
      if (sortBy === "rating")
        return (b.rating?.score ?? -1) - (a.rating?.score ?? -1);
      if (sortBy === "demand")
        return (b.totalHires ?? 0) - (a.totalHires ?? 0);
      if (sortBy === "price")
        return Number(a.priceLamports) - Number(b.priceLamports);
      return b.createdAt.localeCompare(a.createdAt);
    });
  // "Mine" means I published the build or I am already the payout wallet —
  // either way renting from myself is not a thing, and claiming is.
  const isMine = (l: Listing) =>
    Boolean(l.isMine) || (!!wallet && l.developerWallet === wallet);
  const publisherOf = (l: Listing) =>
    l.publisherWallet ?? l.developerWallet ?? null;

  const [focusedId, setFocusedId] = useState<string>("");
  const featured = filtered.find((l) => l.id === focusedId) ?? filtered[0];
  const focusAt = featured ? filtered.indexOf(featured) : 0;
  const move = (delta: number) =>
    setFocusedId(
      filtered[(focusAt + delta + filtered.length) % filtered.length]?.id ?? "",
    );
  return (
    <div className="marketplace-workspace">
      <div className="market-toolbar">
        <label className="search">
          <Search size={15} />
          <input
            aria-label="Search published agents"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents, strategies…"
          />
        </label>
        <button
          className="btn btn-ghost"
          aria-pressed={pricedOnly}
          onClick={() => setPricedOnly((v) => !v)}
        >
          <ShieldCheck size={13} />
          Rentable only
        </button>
        {/* Sorting by reputation or demand is the only reason to compute them.
            "Newest" stays the default so a fresh listing is not buried by an
            older one purely for having been around longer. */}
        <div className="market-sort" role="group" aria-label="Sort listings">
          {MARKET_SORTS.map(([key, label]) => (
            <button
              key={key}
              className="btn btn-ghost btn-sm"
              aria-pressed={sortBy === key}
              onClick={() => setSortBy(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="chip chip-info">{filtered.length} VERSIONS</span>
      </div>
      {wallet && !signedIn && (
        <p className="help market-signin-note" role="status">
          Wallet connected, but not signed in. Renting, claiming and reviewing
          need a signature — the API cannot tell a connected wallet from a
          typed address. Use “Sign in” in the top bar.
        </p>
      )}
      {error && (
        <div className="error-note" role="alert">
          {error}
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {featured ? (
        <>
          <div className="spot">
            <div className="feature">
              <section
                className="fcard"
                style={{ "--acc": "214,64,142" } as React.CSSProperties}
                key={featured.id}
              >
                <div className="kick">
                  <small>FEATURED · IMMUTABLE BUILD</small>
                  <span className="chip chip-info">
                    {featured.agentVersion.version}
                  </span>
                  <RatingBadge rating={featured.rating} />
                  {isMine(featured) && (
                    <span className="chip chip-gold">YOURS</span>
                  )}
                </div>
                <div className="cluster" aria-hidden="true">
                  <VoxelCube size={44} />
                  <VoxelCube size={32} tone="info" />
                  <VoxelCube size={26} tone="ok" />
                </div>
                <h2>
                  {featured.agentVersion.name}
                  <span>Built to act within boundaries.</span>
                </h2>
                <p>{featured.agentVersion.strategy}</p>
                <div className="meta">
                  <div>
                    <small>ACTIVE HIRES</small>
                    <b>{featured.activeHires}</b>
                  </div>
                  <div>
                    <small>AGENT HASH</small>
                    <b>{short(featured.agentVersion.agentHash, 4)}</b>
                  </div>
                  <div>
                    <small>PUBLISHER</small>
                    <b>
                      {publisherOf(featured)
                        ? short(publisherOf(featured) as string, 4)
                        : "Unclaimed"}
                    </b>
                  </div>
                </div>
                {/* Demand, from records that already existed: hire rows and the
                    `listing.hired` audit events carrying what was paid. */}
                <div className="meta demand">
                  <div>
                    <small>RENTALS</small>
                    <b>{featured.totalHires ?? 0}</b>
                    <small>{featured.hires24h ?? 0} in 24h</small>
                  </div>
                  <div>
                    <small>PAID OUT</small>
                    <b>{fmtSol(featured.volumeLamports ?? "0")} SOL</b>
                    <small>all time</small>
                  </div>
                  <div>
                    <small>LAST RENTED</small>
                    <b>
                      {featured.lastHiredAt
                        ? new Date(featured.lastHiredAt).toLocaleDateString()
                        : "—"}
                    </b>
                    <small>
                      published{" "}
                      {new Date(featured.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                </div>
                <div className="cta">
                  <div className="price">
                    <b>
                      {Number(featured.priceLamports) > 0
                        ? `${fmtSol(featured.priceLamports)} SOL`
                        : "Unpriced"}
                    </b>
                    <small>per 24-hour period</small>
                  </div>
                  <div className="dur">
                    {[24, 48, 72].map((h) => (
                      <button
                        key={h}
                        aria-pressed={hoursFor(featured.id) === h}
                        onClick={() =>
                          setHours((v) => ({ ...v, [featured.id]: h }))
                        }
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
                {Number(featured.priceLamports) > 0 &&
                featured.developerWallet ? (
                  <>
                    <button
                      className="btn btn-gold full-button rentbtn"
                      onClick={() => void rent(featured)}
                      disabled={
                        !connected?.signer ||
                        !signedIn ||
                        busy !== "" ||
                        isMine(featured)
                      }
                      title={
                        isMine(featured)
                          ? "You publish this agent"
                          : !connected?.signer
                            ? "Connect a wallet to rent"
                            : !signedIn
                              ? "Sign in with your wallet to rent"
                              : ""
                      }
                    >
                      <Wallet size={14} />
                      {busy === featured.id
                        ? "Waiting for wallet / verification…"
                        : isMine(featured)
                          ? "This is your listing"
                          : !wallet
                            ? "Connect wallet to rent"
                            : !signedIn
                              ? "Sign in to rent"
                              : "Rent with wallet"}
                      <ArrowRight size={14} />
                    </button>
                    <p className="help">
                      Total{" "}
                      {fmtSol(
                        String(
                          BigInt(featured.priceLamports) *
                            BigInt(periodsFor(featured.id)),
                        ),
                      )}{" "}
                      SOL · {hoursFor(featured.id)} hours
                    </p>
                  </>
                ) : (
                  <p className="help">
                    The publisher must configure a price before this version can
                    be rented.
                  </p>
                )}
                {/* Only the publisher (or the wallet already being paid) can
                    claim: the payout wallet is write-once on the API, so
                    offering "Claim" to anyone else would only lead to a 403. */}
                {wallet && isMine(featured) && (
                    <div className="publisher-pricing">
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={!signedIn}
                        title={
                          signedIn
                            ? ""
                            : "Sign in with your wallet to claim this listing"
                        }
                        onClick={() => {
                          setEditing(
                            editing === featured.id ? null : featured.id,
                          );
                          setPriceSol(fmtSol(featured.priceLamports));
                        }}
                      >
                        {featured.developerWallet
                          ? "Edit publisher price"
                          : "Claim listing · set price"}
                      </button>
                      {editing === featured.id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void savePrice(featured);
                          }}
                        >
                          <label>
                            Price per day · SOL
                            <input
                              type="number"
                              step="0.000001"
                              min="0.000001"
                              required
                              value={priceSol}
                              onChange={(e) => setPriceSol(e.target.value)}
                            />
                          </label>
                          <button className="btn btn-gold" disabled={!!busy}>
                            Save price
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                <div className="reputation">
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-expanded={reviewsOpen}
                    onClick={() => setReviewsOpen((v) => !v)}
                  >
                    {reviewsOpen
                      ? "Hide reputation"
                      : `Reputation & reviews${
                          featured.rating?.reviews.count
                            ? ` (${featured.rating.reviews.count})`
                            : ""
                        }`}
                  </button>
                  {reviewsOpen && (
                    <ReviewPanel
                      key={featured.id}
                      listingId={featured.id}
                      wallet={wallet}
                    />
                  )}
                </div>
              </section>
            </div>
            <div className="flow-wrap">
              <div className="eyebrow">EXPLORE THE REGISTRY</div>
              <div className="cover-flow">
                {filtered.map((l, i) => {
                  const delta = i - focusAt;
                  if (Math.abs(delta) > 2) return null;
                  return (
                    <button
                      className="cf"
                      key={l.id}
                      data-pos={delta}
                      style={
                        {
                          "--acc": [
                            "14,145,205",
                            "133,219,192",
                            "223,195,140",
                            "214,64,142",
                          ][i % 4],
                        } as React.CSSProperties
                      }
                      onClick={() => setFocusedId(l.id)}
                      aria-label={`View ${l.agentVersion.name}`}
                    >
                      <span className="av">
                        <Bot size={21} />
                      </span>
                      <b>{l.agentVersion.name}</b>
                      <small>
                        {l.agentVersion.version} ·{" "}
                        {short(l.agentVersion.agentHash, 4)}
                      </small>
                      <p>{l.agentVersion.strategy}</p>
                      <div className="pr">
                        {Number(l.priceLamports) > 0
                          ? `${fmtSol(l.priceLamports)} SOL`
                          : "Unpriced"}
                        <span>{l.activeHires} active hires</span>
                      </div>
                    </button>
                  );
                })}
                <div className="cf-floor" />
              </div>
              <div className="cf-nav">
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label="Previous agent"
                  onClick={() => move(-1)}
                >
                  <ArrowLeft size={14} />
                </button>
                <span className="mono">
                  {focusAt + 1} / {filtered.length}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  aria-label="Next agent"
                  onClick={() => move(1)}
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
          <section className="panel registry-table">
            <div className="ph">
              <h2>All published versions</h2>
              <span className="chip chip-info">{filtered.length} VERSIONS</span>
            </div>
            <div className="registry-scroll">
              <div className="listing registry-head">
                <span />
                <span>AGENT</span>
                <span>HASH</span>
                <span>PUBLISHER</span>
                <span>HIRES · LIVE / ALL</span>
                <span>PRICE / DAY</span>
                <span />
              </div>
              {filtered.map((l) => (
                <div className="listing" key={l.id}>
                  <span className="av">
                    <Bot size={14} />
                  </span>
                  <span>
                    <b>
                      {l.agentVersion.name}
                      {isMine(l) && <span className="chip chip-gold">YOURS</span>}
                    </b>
                    <small>
                      {l.agentVersion.version} <RatingBadge rating={l.rating} />
                    </small>
                  </span>
                  <span className="m">
                    {short(l.agentVersion.agentHash, 5)}
                  </span>
                  <span className="m">
                    {publisherOf(l)
                      ? short(publisherOf(l) as string, 5)
                      : "Unclaimed"}
                  </span>
                  <span>
                    {l.activeHires} / {l.totalHires ?? 0}
                  </span>
                  <span className="p">
                    {Number(l.priceLamports) > 0
                      ? `${fmtSol(l.priceLamports)} SOL`
                      : "—"}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setFocusedId(l.id);
                      document
                        .querySelector(".main-scroll")
                        ?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    View <ArrowUpRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="empty-state">
            {loadFailed
              ? "The registry could not be loaded. Retry the connection above."
              : "No published versions match this search."}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── 5. VAULT ── */
export function VaultPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [sol, setSol] = useState<number | null>(null);
  const [events, setEvents] = useState<AuditRow[]>([]);

  useEffect(() => {
    if (!owner) {
      setSol(null);
      setEvents([]);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const balance = await client.rpc.getBalance(address(owner)).send();
        if (live) setSol(Number(balance.value) / 1_000_000_000);
      } catch {
        if (live) setSol(null);
      }
      try {
        const rows = await api.audit();
        if (live)
          setEvents(
            rows
              .filter(
                (r) =>
                  r.actorType === "owner" ||
                  r.eventType.startsWith("chain.") ||
                  r.eventType === "vault.funded",
              )
              .slice(-8)
              .reverse(),
          );
      } catch {
        /* the panel above already surfaces API errors */
      }
    };
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [client, owner]);

  return (
    <div className="route-page treasury-workspace">
      <VaultPanel />
      <aside className="treasury-side">
        <section className="panel">
          <div className="ph">
            <h2>Owner wallet</h2>
            <span className="chip chip-info">DEVNET</span>
          </div>
          <div className="pb">
            <div className="vault-wallet-number">
              {owner && sol !== null
                ? sol.toLocaleString(undefined, { maximumFractionDigits: 4 })
                : "—"}{" "}
              <small>SOL</small>
            </div>
            <p className="help">Devnet SOL pays transaction fees.</p>
            {owner ? (
              <a
                className="hash-preview"
                href={explorerAddressUrl(owner)}
                target="_blank"
                rel="noreferrer"
              >
                {owner} ↗
              </a>
            ) : (
              <>
                <p className="help">
                  Connect your wallet to load its vault, balances and signing
                  controls.
                </p>
                <SolanaWalletControl />
              </>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="ph">
            <h2>Recent chain activity</h2>
            <span className="chip chip-dim">LATEST 8</span>
          </div>
          <div className="pb">
            {events.length ? (
              events.map((e) => (
                <div className="treasury-event" key={e.id}>
                  <span className="chip chip-info">{e.eventType}</span>
                  <small>{new Date(e.createdAt).toLocaleString()}</small>
                  {e.chainSignature && (
                    <a
                      href={explorerTransactionUrl(e.chainSignature)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {short(e.chainSignature, 8)} ↗
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="empty-state">
                <Activity size={28} />
                <p>
                  {owner
                    ? "No recorded transactions yet."
                    : "Activity loads after connecting a wallet."}
                </p>
              </div>
            )}
          </div>
        </section>
        <div className="treasury-boundary">
          <ShieldCheck size={20} />
          <p>
            Assets remain in a program-owned vault. The agent can only move them
            within an owner-signed policy.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ── 7. SESSIONS ── */
export function SessionsPage() {
  const [step, setStep] = useState(0);
  const [tokens, setTokens] = useState(["SOL", "USDC"]);
  const [cap, setCap] = useState(500);
  const [txn, setTxn] = useState(50);
  const [dur, setDur] = useState(24);
  const [cool, setCool] = useState(6);
  // Seeded from the demo ops wallet so the default flow still works, but the
  // destination allowlist is the product's headline promise — it belongs to
  // the owner, not to a build-time constant.
  const [dests, setDests] = useState<string[]>(
    [DEMO_OPS_DESTINATION].filter(Boolean),
  );
  const [agentVersions, setAgentVersions] = useState<AgentVersion[]>([]);
  const [agentId, setAgentId] = useState("");
  // Rentals this wallet holds. An agent someone else publishes and prices is
  // only grantable while a rental covers it — the API checks, this just lets
  // the wizard say so before the wallet is asked to sign.
  const [hires, setHires] = useState<Hire[]>([]);
  const wizardClient = useClient<AppClient>();
  const wizardWallet = useConnectedWallet(wizardClient);
  const wallet = wizardWallet ? String(wizardWallet.account.address) : "";
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");
  const [grantsKey, setGrantsKey] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .agents()
      .then((list) => {
        if (!live) return;
        setAgentVersions(list);
        setAgentId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => {
        /* none published yet: the sign step publishes one from this policy */
      });
    if (wallet)
      api
        .hires(wallet)
        .then((h) => {
          if (live) setHires(h);
        })
        .catch(() => {
          /* no rentals is not an error */
        });
    return () => {
      live = false;
    };
  }, [grantsKey, wallet]);
  const tList = ["SOL", "USDC", "JUP", "JTO", "BONK", "PYTH"];
  const STEPS = ["Scope", "Spend Limits", "Time Bounds", "Review & Sign"];

  const cleanDests = [...new Set(dests.map((d) => d.trim()).filter(Boolean))];
  const destError = dests.some((d) => d.trim() && !isAddressLike(d.trim()))
    ? "One of these is not a valid Solana address."
    : cleanDests.length === 0
      ? "Add at least one address the agent may pay."
      : cleanDests.length !== dests.filter((d) => d.trim()).length
        ? "Duplicate destinations are ignored."
        : "";
  const destsInvalid =
    cleanDests.length === 0 ||
    dests.some((d) => d.trim() && !isAddressLike(d.trim()));

  // Which published agent version this grant authorises. The grant records it,
  // so picking the wrong one would put the wrong agentHash in the audit trail.
  const selectedAgent = agentVersions.find((a) => a.id === agentId) ?? null;
  const activeHire = selectedAgent
    ? (hires.find(
        (h) =>
          h.listing?.agentVersionId === selectedAgent.id &&
          new Date(h.endsAt) > new Date(),
      ) ?? null)
    : null;
  const policy: AgentPolicyInput = {
    agentName: selectedAgent?.name ?? FALLBACK_AGENT.name,
    strategy: selectedAgent?.strategy ?? FALLBACK_AGENT.strategy,
    tokens,
    spendCapUsdc: cap,
    maxTransactions: txn,
    durationHours: dur,
    cooldownMinutes: cool,
  };

  // Destinations are part of the signed policy digest, so a change to them
  // invalidates the reviewed policy just as a cap change does.
  useEffect(() => {
    setAssessment(null);
    setAssessmentError("");
  }, [tokens, cap, txn, dur, cool, dests]);

  async function assessPolicy() {
    setAssessing(true);
    setAssessmentError("");
    try {
      setAssessment(await requestRiskAssessment(policy));
    } catch (error) {
      setAssessmentError(
        error instanceof Error
          ? error.message
          : "Unable to assess this policy.",
      );
    } finally {
      setAssessing(false);
    }
  }

  function SliderCtl({
    label,
    value,
    onChange,
    min,
    max,
    unit,
    accent,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    unit: string;
    accent: string;
  }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div className="space-y-2.5">
        <div className="flex justify-between">
          <span
            className="text-xs"
            style={{ ...sans, color: color.textSecondary }}
          >
            {label}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{
              ...mono,
              color: accent,
              background: `${accent}12`,
              border: `1px solid ${accent}20`,
            }}
          >
            {value.toLocaleString()}
            {unit}
          </span>
        </div>
        <div className="relative h-6 flex items-center">
          <div
            className="absolute left-0 right-0 h-1.5 rounded-full pointer-events-none"
            style={{ background: color.surfaceInset }}
          />
          <div
            className="absolute left-0 h-1.5 rounded-full pointer-events-none"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${accent}60, ${accent})`,
            }}
          />
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(+e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div
            className="absolute w-3.5 h-3.5 rounded-full border-2 transition-all pointer-events-none"
            style={{
              left: `calc(${pct}% - 7px)`,
              background: color.surface,
              borderColor: accent,
              boxShadow: "0 2px 8px rgba(4, 2, 12, 0.7)",
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="route-page page-guardrails space-y-8">
      <div className="route-local-heading">
        <h1
          className="text-2xl font-bold"
          style={{ ...sans, color: color.text }}
        >
          Agent Guardrails
        </h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>
          Design bounded Solana policies, run AI risk checks, and publish
          verifiable proofs
        </p>
      </div>

      {/* Real grants from the REDLINE API (on-chain state via /grants/:id) */}
      <GrantsPanel refreshKey={grantsKey} />

      {/* Live transfer lane — replays the program's verdict for every proposal (SSE) */}
      <TransferLane />

      {/* New session wizard */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ ...glass(), boxShadow: "0 18px 48px rgba(4, 2, 12, 0.55)" }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: color.border, background: `${M}04` }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="p-1.5 rounded-lg"
              style={{ background: `${M}14`, border: `1px solid ${M}25` }}
            >
              <Key size={12} style={{ color: M }} />
            </div>
            <span
              className="text-sm font-semibold"
              style={{ ...sans, color: color.text }}
            >
              Create Agent Policy
            </span>
            <span
              className="ml-auto text-[12px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                ...mono,
                background: `${C}14`,
                color: C,
                border: `1px solid ${C}25`,
              }}
            >
              SOLANA DEVNET
            </span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <button
                type="button"
                key={`wiz-step-${i}`}
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s}`}
                className="flex-1 flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-full h-0.5 rounded-full transition-all"
                  style={{
                    background:
                      i <= step ? (i === step ? M : `${M}50`) : color.border,
                  }}
                />
                <span
                  className="text-[11px] font-semibold hidden sm:block"
                  style={{
                    ...mono,
                    color:
                      i === step
                        ? M
                        : i < step
                          ? `${M}60`
                          : "rgba(148,163,184,0.35)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")} {s}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-6" style={{ minHeight: 240 }}>
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p
                  className="text-xs"
                  style={{
                    ...sans,
                    color: color.textSecondary,
                    lineHeight: 1.7,
                  }}
                >
                  Which published agent version does this grant authorise? The
                  grant records its <code>agentHash</code>, so this is the build
                  the policy is bound to.
                </p>
                {agentVersions.length > 0 ? (
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    aria-label="Agent version this grant authorises"
                    className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
                    style={{
                      ...mono,
                      background: color.surfaceSubtle,
                      border: `1px solid ${color.border}`,
                      color: color.text,
                    }}
                  >
                    {agentVersions.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        style={{ background: color.surface }}
                      >
                        {a.name} {a.version} · {a.agentHash.slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                ) : (
                  <p
                    className="text-[13px] px-3 py-2 rounded-xl"
                    style={{
                      ...sans,
                      background: `${A}0b`,
                      border: `1px solid ${A}25`,
                      color: color.warn,
                    }}
                  >
                    No agent published yet — signing this grant publishes “
                    {FALLBACK_AGENT.name}” and binds the grant to it. Publish
                    from the Agents page first to name your own.
                  </p>
                )}
                {selectedAgent && (
                  <p
                    className="text-[12px]"
                    style={{ ...sans, color: color.textMuted, lineHeight: 1.6 }}
                  >
                    {selectedAgent.strategy}
                  </p>
                )}
                {activeHire && (
                  <p
                    className="text-[12px] px-3 py-2 rounded-xl"
                    style={{
                      ...sans,
                      background: `${C}0b`,
                      border: `1px solid ${C}25`,
                      color: C,
                      lineHeight: 1.6,
                    }}
                  >
                    Running under your rental of this agent — it covers grants
                    until{" "}
                    {new Date(activeHire.endsAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    . The grant records which rental authorised it.
                  </p>
                )}
              </div>
              <p
                className="text-xs"
                style={{ ...sans, color: color.textSecondary, lineHeight: 1.7 }}
              >
                Allowlist the SPL assets this agent may reference. Every other
                mint remains outside the signed policy.
              </p>
              <div className="flex flex-wrap gap-2">
                {tList.map((t, ti) => {
                  const on = tokens.includes(t);
                  return (
                    <button
                      type="button"
                      key={`wiz-tok-${ti}`}
                      onClick={() =>
                        setTokens((p) =>
                          p.includes(t) ? p.filter((x) => x !== t) : [...p, t],
                        )
                      }
                      aria-pressed={on}
                      className="px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all"
                      style={{
                        ...mono,
                        background: on ? `${M}14` : color.surfaceSubtle,
                        border: `1px solid ${on ? M + "40" : color.border}`,
                        color: on ? M : color.textMuted,
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="pt-1 space-y-2">
                <p
                  className="text-xs"
                  style={{
                    ...sans,
                    color: color.textSecondary,
                    lineHeight: 1.7,
                  }}
                >
                  Allowlist the addresses this agent may pay. The program checks
                  every transfer against this list — an address that is not here
                  cannot receive funds, whatever the agent proposes. Up to{" "}
                  {MAX_DESTS}.
                </p>
                {dests.map((d, di) => (
                  <div key={`dest-${di}`} className="flex gap-2">
                    <input
                      value={d}
                      onChange={(e) =>
                        setDests((p) =>
                          p.map((x, i) =>
                            i === di ? e.target.value.trim() : x,
                          ),
                        )
                      }
                      placeholder="Recipient address (base58)"
                      aria-label={`Allowed destination ${di + 1}`}
                      spellCheck={false}
                      className="flex-1 px-3 py-2 rounded-xl text-[13px] outline-none"
                      style={{
                        ...mono,
                        background: color.surfaceSubtle,
                        border: `1px solid ${d && !isAddressLike(d) ? "#ef444455" : color.border}`,
                        color: color.text,
                      }}
                    />
                    {dests.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDests((p) => p.filter((_, i) => i !== di))
                        }
                        aria-label={`Remove destination ${di + 1}`}
                        className="px-3 rounded-xl text-[13px]"
                        style={{
                          ...mono,
                          background: color.surfaceSubtle,
                          border: `1px solid ${color.border}`,
                          color: color.textMuted,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {dests.length < MAX_DESTS && (
                  <button
                    type="button"
                    onClick={() => setDests((p) => [...p, ""])}
                    className="text-[13px] px-3 py-1.5 rounded-xl"
                    style={{
                      ...mono,
                      background: `${C}10`,
                      border: `1px solid ${C}25`,
                      color: C,
                    }}
                  >
                    + Add destination
                  </button>
                )}
                {destError && (
                  <p
                    role="alert"
                    className="text-[12px]"
                    style={{ ...sans, color: color.danger }}
                  >
                    {destError}
                  </p>
                )}
              </div>
              <div
                className="rounded-xl p-3 flex gap-2.5"
                style={{ background: `${C}0a`, border: `1px solid ${C}18` }}
              >
                <Lock
                  size={12}
                  style={{ color: C, marginTop: 1, flexShrink: 0 }}
                />
                <p
                  className="text-[13px]"
                  style={{
                    ...sans,
                    color: color.textSecondary,
                    lineHeight: 1.6,
                  }}
                >
                  The policy digest binds token scope, the destination
                  allowlist, spend cap, execution limit, cooldown, and validity
                  window into one verifiable proof.
                </p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <p
                className="text-xs"
                style={{ ...sans, color: color.textSecondary }}
              >
                Configure total spend ceiling and per-session transaction
                limits.
              </p>
              <SliderCtl
                label="Total Spend Cap"
                value={cap}
                onChange={setCap}
                min={10}
                max={10000}
                unit=" USDC"
                accent={A}
              />
              <SliderCtl
                label="Max Transactions / Session"
                value={txn}
                onChange={setTxn}
                min={1}
                max={500}
                unit=" txns"
                accent={C}
              />
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Avg/Tx",
                    value: `$${(cap / txn).toFixed(2)}`,
                    color: A,
                  },
                  {
                    label: "Risk",
                    value: cap > 5000 ? "HIGH" : cap > 1000 ? "MED" : "LOW",
                    color: cap > 5000 ? color.danger : cap > 1000 ? A : M,
                  },
                  { label: "Tokens", value: String(tokens.length), color: C },
                ].map((row, ri) => (
                  <div
                    key={`wiz-row-${ri}`}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: color.surfaceSubtle,
                      border: `1px solid ${color.border}`,
                    }}
                  >
                    <div
                      className="text-[12px] mb-1"
                      style={{ ...sans, color: color.textMuted }}
                    >
                      {row.label}
                    </div>
                    <div
                      className="text-sm font-bold"
                      style={{ ...mono, color: row.color }}
                    >
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <p
                className="text-xs"
                style={{ ...sans, color: color.textSecondary }}
              >
                Set validity window and minimum cooldown between executions.
              </p>
              <SliderCtl
                label="Session Duration"
                value={dur}
                onChange={setDur}
                min={1}
                max={168}
                unit="h"
                accent={M}
              />
              <SliderCtl
                label="Execution Cooldown"
                value={cool}
                onChange={setCool}
                min={1}
                max={60}
                unit="m"
                accent={C}
              />
              <div
                className="rounded-xl p-3.5 flex items-center gap-3"
                style={{ background: `${M}09`, border: `1px solid ${M}18` }}
              >
                <Timer size={14} style={{ color: M, flexShrink: 0 }} />
                <div>
                  <div
                    className="text-[13px] font-semibold"
                    style={{ ...mono, color: M }}
                  >
                    Expires{" "}
                    {new Date(Date.now() + dur * 3600000).toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </div>
                  <div
                    className="text-[12px] mt-0.5"
                    style={{ ...sans, color: color.textMuted }}
                  >
                    ≤ {Math.floor((dur * 60) / cool)} executions · {cool}m
                    cooldown
                  </div>
                </div>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p
                className="text-xs"
                style={{ ...sans, color: color.textSecondary }}
              >
                Review the bounded policy, run the risk copilot, then sign the
                on-chain grant. The program enforces these limits on every agent
                transfer.
              </p>
              <div>
                {[
                  [
                    "Agent",
                    selectedAgent
                      ? `${selectedAgent.name} ${selectedAgent.version}`
                      : `${FALLBACK_AGENT.name} (new)`,
                    M,
                  ],
                  [
                    "Rental",
                    activeHire
                      ? `until ${new Date(activeHire.endsAt).toLocaleDateString()}`
                      : "not rented — yours to run",
                    C,
                  ],
                  ["Token Scope", tokens.join(", "), C],
                  [
                    "Destinations",
                    cleanDests.map((d) => short(d, 6)).join(", ") || "none",
                    A,
                  ],
                  ["Spend Cap", `${cap.toLocaleString()} USDC`, A],
                  ["Max Txns", `${txn} transactions`, C],
                  ["Duration", `${dur} hours`, M],
                  ["Cooldown", `${cool} minutes`, M],
                  ["Network", "Solana Devnet", C],
                ].map(([k, v, col], ri) => (
                  <div
                    key={`rev-${ri}`}
                    className="flex justify-between py-2.5 border-b"
                    style={{ borderColor: color.border }}
                  >
                    <span
                      className="text-[13px]"
                      style={{ ...sans, color: color.textMuted }}
                    >
                      {k}
                    </span>
                    <span
                      className="text-[13px] font-semibold"
                      style={{ ...mono, color: col as string }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              {assessment && (
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{
                    background: `${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : color.danger}0b`,
                    border: `1px solid ${assessment.decision === "ALLOW" ? M : assessment.decision === "REVIEW" ? A : color.danger}25`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div
                        className="text-xs font-semibold"
                        style={{ color: color.text }}
                      >
                        Risk copilot verdict
                      </div>
                      <div
                        className="text-[12px] mt-0.5"
                        style={{ color: color.textMuted }}
                      >
                        {assessment.source === "openai"
                          ? `OpenAI · ${assessment.model}`
                          : assessment.source === "openai+deterministic-floor"
                            ? `OpenAI + deterministic safety floor · ${assessment.model}`
                            : "Deterministic safety fallback"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-xl font-bold"
                        style={{
                          ...mono,
                          color:
                            assessment.decision === "ALLOW"
                              ? M
                              : assessment.decision === "REVIEW"
                                ? A
                                : color.danger,
                        }}
                      >
                        {assessment.score}/100
                      </div>
                      <div
                        className="text-[12px]"
                        style={{ ...mono, color: color.textSecondary }}
                      >
                        {assessment.decision}
                      </div>
                    </div>
                  </div>
                  <p
                    className="text-[13px]"
                    style={{ color: color.textSecondary }}
                  >
                    {assessment.summary}
                  </p>
                  <ul className="space-y-1">
                    {assessment.findings.slice(0, 3).map((finding, index) => (
                      <li
                        key={`finding-${index}`}
                        className="text-[12px] flex gap-2"
                        style={{ color: color.textMuted }}
                      >
                        <span style={{ color: C }}>•</span>
                        {finding}
                      </li>
                    ))}
                  </ul>
                  <GrantSignButton
                    policy={policy}
                    assessment={assessment}
                    destinations={cleanDests}
                    destinationsInvalid={destsInvalid}
                    agentVersionId={selectedAgent?.id ?? null}
                    hireId={activeHire?.id ?? null}
                    onCreated={() => setGrantsKey((k) => k + 1)}
                  />
                </div>
              )}
              {assessmentError && (
                <p
                  role="alert"
                  className="text-[12px]"
                  style={{ color: color.danger }}
                >
                  {assessmentError}
                </p>
              )}
            </div>
          )}
        </div>
        <div
          className="px-6 py-4 border-t flex gap-2"
          style={{ borderColor: color.border }}
        >
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-25"
            style={{
              ...sans,
              background: color.surfaceInset,
              border: `1px solid ${color.border}`,
              color: color.textSecondary,
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() =>
              step < STEPS.length - 1
                ? setStep((s) => s + 1)
                : void assessPolicy()
            }
            disabled={assessing}
            className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{
              ...sans,
              background: step === STEPS.length - 1 ? color.primary : `${M}12`,
              border: `1px solid ${step === STEPS.length - 1 ? color.primary : M + "35"}`,
              color: step === STEPS.length - 1 ? color.onAccent : M,
              boxShadow:
                step === STEPS.length - 1
                  ? "0 6px 18px rgba(167,139,250,0.28)"
                  : "none",
            }}
          >
            {step === STEPS.length - 1 ? (
              <>
                <Shield size={12} />
                {assessing
                  ? "Assessing policy…"
                  : assessment
                    ? "Re-run risk assessment"
                    : "Run AI risk assessment"}
              </>
            ) : (
              <>
                Continue <ChevronRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 8. SETTINGS ── */
export function SettingsPage() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const wallet = connected ? String(connected.account.address) : "";
  const [health, setHealth] = useState<Health | null>(null);
  const [healthState, setHealthState] = useState<
    "checking" | "healthy" | "offline"
  >("checking");
  const [activeTab, setActiveTab] = useState(0);
  const [depthEnabled, setDepthEnabled] = useState(() =>
    readPreference("depth"),
  );
  const [motionEnabled, setMotionEnabled] = useState(() =>
    readPreference("motion"),
  );
  useEffect(() => {
    applyPreference("depth", depthEnabled);
    applyPreference("motion", motionEnabled);
  }, [depthEnabled, motionEnabled]);
  const signedIn = useSignedIn(wallet);
  const session = signedIn ? loadSession() : null;
  const tabs = [
    { label: "Network", detail: "Cluster · program · executor", icon: Network },
    {
      label: "Wallet & demo assets",
      detail: "Owner · mints · destinations",
      icon: Wallet,
    },
    {
      label: "Policy invariants",
      detail: "What the program enforces",
      icon: Lock,
    },
    { label: "Experience", detail: "Sound · depth · motion", icon: Sparkles },
  ];

  const testHealth = useCallback(async () => {
    setHealthState("checking");
    try {
      const result = await checkHealth();
      setHealth(result);
      setHealthState("healthy");
    } catch {
      setHealth(null);
      setHealthState("offline");
    }
  }, []);

  useEffect(() => {
    let live = true;
    checkHealth()
      .then((h) => {
        if (live) {
          setHealth(h);
          setHealthState("healthy");
        }
      })
      .catch(() => {
        if (live) {
          setHealth(null);
          setHealthState("offline");
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const healthLabel = healthState === "checking" ? "checking" : healthState;

  function Row({
    label,
    value,
    accent = M,
  }: {
    label: string;
    value: string;
    accent?: string;
  }) {
    return (
      <div
        className="flex items-center justify-between py-3 border-b gap-4"
        style={{ borderColor: color.border }}
      >
        <span
          className="text-xs shrink-0"
          style={{ ...sans, color: color.textSecondary }}
        >
          {label}
        </span>
        <span
          className="text-xs font-semibold text-right break-all"
          style={{ ...mono, color: accent }}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="route-page page-settings">
      <div className="route-local-heading">
        <h1
          className="text-2xl font-bold"
          style={{ ...sans, color: color.text }}
        >
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ ...sans, color: color.textDim }}>
          Live configuration of this REDLINE deployment
        </p>
      </div>
      <div className="settings-artifact-shell">
        <aside className="settings-artifact-nav" style={{ ...glass() }}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                role="tab"
                key={tab.label}
                onClick={() => setActiveTab(index)}
                aria-selected={activeTab === index}
              >
                <span>
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.detail}</small>
                </span>
                <ChevronRight size={14} />
              </button>
            );
          })}
          <div className="settings-backend-anchor">
            <i className={health ? "is-live" : ""} />
            <span>Backend anchor · devnet · {healthLabel}</span>
          </div>
        </aside>

        <section className="settings-artifact-panel" style={{ ...glass() }}>
          {activeTab === 0 && (
            <>
              <header>
                <div>
                  <span>NETWORK</span>
                  <h2>Network</h2>
                </div>
                <em className={health ? "is-live" : ""}>
                  <i />
                  {healthLabel.toUpperCase()}
                </em>
              </header>
              {/* Cluster and commitment are properties of the deployed API, not
                  switches this page owns. They are reported, not offered — the
                  old three-button rows implied a choice that changed nothing. */}
              <Row
                label="Cluster"
                value={
                  health?.cluster ??
                  (health?.chain === "mock"
                    ? "mock"
                    : healthState === "checking"
                      ? "checking…"
                      : "unreachable")
                }
                accent={health ? C : A}
              />
              <Row
                label="Chain adapter"
                value={health?.chain ?? "unknown"}
                accent={health?.chain === "solana" ? M : A}
              />
              <Row label="Commitment" value="confirmed" accent={color.textMuted} />
              <Row
                label="Program"
                value={health?.programId ?? PROGRAM_ID}
                accent={C}
              />
              <Row
                label="Executor"
                value={
                  health?.executor ??
                  (healthState === "checking" ? "checking…" : "unreachable")
                }
                accent={
                  health
                    ? C
                    : healthState === "checking"
                      ? color.textMuted
                      : color.danger
                }
              />
              <Row
                label="Chain indexer"
                value={health?.indexer ?? "unknown"}
                accent={health?.indexer === "running" ? M : A}
              />
              <Row
                label="API build"
                value={health?.version ?? "unknown"}
                accent={color.textMuted}
              />
              <Row
                label="Rate limit"
                value={
                  health?.rateLimitPerMinute
                    ? `${health.rateLimitPerMinute} req/min per IP`
                    : "unknown"
                }
                accent={color.textMuted}
              />
              <label className="settings-api-row">
                <span>API URL</span>
                <div>
                  <input readOnly value={API_URL} />
                  <button
                    type="button"
                    onClick={() => void testHealth()}
                    disabled={healthState === "checking"}
                  >
                    {healthState === "checking" ? "Testing…" : "Test"}
                  </button>
                </div>
              </label>
            </>
          )}

          {activeTab === 1 && (
            <>
              <header>
                <div>
                  <span>OWNER SESSION</span>
                  <h2>Wallet & demo assets</h2>
                </div>
                <em className={wallet ? "is-live" : ""}>
                  <i />
                  {wallet ? "CONNECTED" : "NOT CONNECTED"}
                </em>
              </header>
              <div className="settings-wallet-card">
                <span>
                  <Wallet size={22} />
                </span>
                <div>
                  <strong>
                    {wallet ? "Connected wallet" : "Wallet required"}
                  </strong>
                  <code>
                    {wallet || "Connect through Wallet Standard in the top bar"}
                  </code>
                </div>
                {wallet && (
                  <a
                    href={explorerAddressUrl(wallet)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <Row
                label="Wallet session"
                value={
                  signedIn && session
                    ? `signed in · expires ${new Date(session.expiresAt).toLocaleString()}`
                    : wallet
                      ? "connected but not signed in"
                      : "no wallet"
                }
                accent={signedIn ? M : A}
              />
              <Row
                label="Writes require a signature"
                value={
                  health?.identityEnforced === undefined
                    ? "unknown"
                    : health.identityEnforced
                      ? "yes — this is a public deployment"
                      : "no — local/mock, writes are open"
                }
                accent={health?.identityEnforced ? M : A}
              />
              <Row
                label="Demo USDC mint (browser)"
                value={
                  import.meta.env.VITE_DEMO_USDC_MINT
                    ? String(import.meta.env.VITE_DEMO_USDC_MINT)
                    : "not configured"
                }
                accent={import.meta.env.VITE_DEMO_USDC_MINT ? C : A}
              />
              <Row
                label="Demo USDC mint (API)"
                value={
                  health?.demoMintConfigured === undefined
                    ? "unknown"
                    : health.demoMintConfigured
                      ? "configured"
                      : "not configured"
                }
                accent={health?.demoMintConfigured ? C : A}
              />
              <Row
                label="Demo destination"
                value={DEMO_OPS_DESTINATION || "not configured"}
                accent={DEMO_OPS_DESTINATION ? C : A}
              />
              {/* This row used to read "configured", which sounded like a
                  security control. It is not one: the key ships inside this
                  page's JavaScript, so anyone can read it. It exists to keep
                  drive-by traffic off the write routes; ownership is proved by
                  the wallet signature above, not by this. */}
              <Row
                label="Bundled write key"
                value={
                  import.meta.env.VITE_API_KEY
                    ? "present in this bundle — public, not a credential"
                    : "none (local/mock)"
                }
                accent={A}
              />
            </>
          )}

          {activeTab === 2 && (
            <>
              <header>
                <div>
                  <span>PROGRAM BOUNDARY</span>
                  <h2>Policy invariants</h2>
                </div>
                <em className="is-live">
                  <i />
                  ON-CHAIN
                </em>
              </header>
              <Row label="Gates enforced in order" value="7" />
              <Row label="Policy digest" value="SHA-256" />
              <Row
                label="Allowlist ceiling"
                value="4 mints · 4 destinations"
                accent={C}
              />
              <Row
                label="Revocation authority"
                value="owner signature"
                accent={C}
              />
              <Row
                label="Execution behavior"
                value="first failed gate stops atomically"
                accent={A}
              />
              <div className="settings-policy-note">
                <ShieldCheck size={16} />
                <p>
                  Each grant is revoked separately because the on-chain program
                  accepts one owner-signed revocation per policy account.
                </p>
              </div>
            </>
          )}

          {activeTab === 3 && (
            <>
              <header>
                <div>
                  <span>LOCAL PREFERENCES</span>
                  <h2>Experience</h2>
                </div>
                <em>
                  <i />
                  THIS DEVICE
                </em>
              </header>
              <button
                type="button"
                className="settings-toggle-row"
                onClick={() => setDepthEnabled((v) => !v)}
                aria-pressed={depthEnabled}
              >
                <span>
                  <strong>3D depth</strong>
                  <small>Perspective, stepped shadows and spatial panels</small>
                </span>
                <i />
              </button>
              <button
                type="button"
                className="settings-toggle-row"
                onClick={() => setMotionEnabled((v) => !v)}
                aria-pressed={motionEnabled}
              >
                <span>
                  <strong>Motion</strong>
                  <small>Page transitions, hover lift and live signals</small>
                </span>
                <i />
              </button>
              <div className="settings-experience-note">
                <Sparkles size={16} />
                <p>
                  Depth and motion are stored on this device and applied
                  immediately. Sound stays in the global header so it follows
                  you across every page.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
