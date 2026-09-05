import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Fingerprint,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import hero from "../../assets/redline-celestial-vault-hero.webp";
import observatory from "../../assets/redline-evidence-observatory.webp";
import citadel from "../../assets/redline-guardrails-citadel.webp";
import vault from "../../assets/redline-treasury-core.webp";
import { RatingBadge, RatingDetail } from "../components/AgentRating";
import { PolicyLab } from "../components/PolicyLab";
import { ProtocolSpine } from "../components/ProtocolSpine";
import { OpenBook, VoxelCube, WaterDivider } from "../components/depth";
import { useRealAgents } from "../lib/agents";
import { api, fmtUsdc, grantExpiresAt, short, type Analytics, type AuditRow } from "../lib/api";
import { useSignedIn } from "../lib/useSignedIn";
import { explorerTransactionUrl, type AppClient } from "../solana/client";

const vars = (value: Record<string, string | number>) => value as CSSProperties;
const scroll = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({
      behavior: document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
export function Panel({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="ph">
        <h2>{title}</h2>
        {meta}
      </div>
      <div className="pb">{children}</div>
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
function useOwner() {
  const client = useClient<AppClient>();
  const wallet = useConnectedWallet(client);
  return wallet ? String(wallet.account.address) : undefined;
}
function useAnalytics() {
  const owner = useOwner();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    const load = () =>
      api
        .analytics(owner)
        .then((r) => {
          if (live) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(String(e.message));
        });
    void load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [owner]);
  return { data, error, owner };
}
function SectionHead({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
}) {
  return (
    <div className="sechead">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="h2">{title}</h2>
      </div>
      {copy && <p className="lede">{copy}</p>}
    </div>
  );
}
function Divider({ children }: { children: string }) {
  return (
    <div className="divider">
      <WaterDivider height={120} className="water" />
      <div className="caption-mid">
        <Sparkles size={12} />
        {children}
      </div>
    </div>
  );
}

export function ArtifactProtocol({ setNav }: { setNav?: (n: number) => void }) {
  const owner = useOwner();
  const [world, setWorld] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const worlds = [
    {
      name: "The Citadel",
      label: "GUARDRAILS",
      image: citadel,
      route: 6,
      copy: "Define the boundary. Give every agent a budget, a destination and a deadline. Seven checks turn an intention into bounded authority.",
    },
    {
      name: "The Vault",
      label: "TREASURY",
      image: vault,
      route: 4,
      copy: "A program-owned account only the policy can move. Refill on devnet, withdraw as the owner — never through the agent.",
    },
    {
      name: "The Observatory",
      label: "AUDIT TRAIL",
      image: observatory,
      route: 5,
      copy: "Every allow and every rejection, decoded from Solana. Follow the signature and inspect the evidence independently.",
    },
  ];
  const chapters = [
    {
      title: "Enforcement",
      copy: "Seven gates, one transaction. The first failed gate closes the path before value can move.",
      id: "enforcement",
    },
    {
      title: "Evidence",
      copy: "A live feed of allows and rejections, each with a signature you can open on Solana Explorer.",
      id: "evidence",
    },
    {
      title: "Ownership",
      copy: "Live grants with spend meters and authority controlled by the owner.",
      id: "ownership",
    },
    {
      title: "Interrogate",
      copy: "Ask the console in English or Vietnamese — grants, gates and reasons for a refusal.",
      id: "interrogate",
    },
  ];
  const selected = worlds[world];
  return (
    <article className="artifact-protocol">
      <section
        className="hero"
        onPointerMove={(e) => {
          if (
            e.pointerType === "touch" ||
            document.documentElement.dataset.motion === "off" ||
            document.documentElement.dataset.depth === "off" ||
            matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({
            x: (-(e.clientY - r.top - r.height / 2) / r.height) * 16,
            y: ((e.clientX - r.left - r.width / 2) / r.width) * 22,
          });
        }}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <div className="art">
          <img src={hero} alt="" fetchPriority="high" />
        </div>
        <div className="wash" />
        <div className="grid" />
        <div className="copy">
          <span className="kicker">
            <Sparkles size={11} /> A NEW ORBIT FOR AUTONOMOUS FINANCE
          </span>
          <h1>
            Intelligence,
            <br />
            without limits.<span className="acc">Authority, with them.</span>
          </h1>
          <p className="lede">
            Let your agents explore. Keep your assets within reach. Seven
            on-chain gates protect the boundary between ambition and permission.
          </p>
          <div className="actions">
            <button className="btn btn-gold" onClick={() => setNav?.(6)}>
              Launch the protocol <ArrowUpRight size={14} />
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => scroll("protocol-worlds")}
            >
              <Play size={12} /> Explore the flow
            </button>
          </div>
        </div>
        <div className="scene" aria-hidden="true">
          <div className="halo" />
          <div className="floor" />
          <div
            className="system"
            style={{
              transform: `translate(-50%, -50%) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className={`orbit o${i}`}>
                <i />
                <b />
              </div>
            ))}
            <div className="crystal">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="face" style={vars({ "--f": i })} />
              ))}
              <div className="heart">
                <ShieldCheck size={34} />
              </div>
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="sat" style={vars({ "--s": i })} />
            ))}
          </div>
          <div className="caption">
            0 / 07 <i />
            <span>THE SENTINEL CORE</span>
          </div>
          <div className="coord">SOLANA · DEVNET · BOUNDARY SYSTEM</div>
        </div>
        <WaterDivider height={150} className="water" />
        {[0, 4, 8, 12].map((delay, i) => (
          <div
            key={delay}
            className="proposal"
            aria-hidden="true"
            style={vars({ "--dl": `${delay}s` })}
          >
            <VoxelCube size={22} tone={i % 2 ? "info" : "gold"} />
          </div>
        ))}
        <button className="scrollcue" onClick={() => scroll("protocol-worlds")}>
          FOLLOW THE CURRENT <ArrowDown size={13} />
        </button>
        <div className="edition">
          <span>REDLINE UNIVERSE</span>
          <i />
          <b>01 — GENESIS</b>
          <span>SOLANA DEVNET</span>
          <i />
          <b>7 GATES · 1 TX</b>
        </div>
      </section>
      <div className="story">
        <section className="sec" id="enforcement">
          <SectionHead
            eyebrow="LIVE POLICY BACKBONE"
            title={
              <>
                Every proposal rides the current
                <br />
                <em>through seven hard limits.</em>
              </>
            }
            copy="The agent proposes. The program evaluates the signed envelope in order, link by link. One failed gate stops the transfer atomically — nothing moves."
          />
          <ProtocolSpine owner={owner} />
        </section>
        <Divider>CHAPTER 01 → THE THREE WORLDS</Divider>
        <section className="sec" id="protocol-worlds">
          <SectionHead
            eyebrow="THE REDLINE UNIVERSE / EXPLORE"
            title={
              <>
                One mission. <em>Three worlds.</em>
              </>
            }
          />
          <div className="wtabs">
            {worlds.map((w, i) => (
              <button
                key={w.name}
                aria-pressed={world === i}
                onClick={() => setWorld(i)}
              >
                <span>0{i + 1}</span>
                {w.name}
                <small>{w.label}</small>
              </button>
            ))}
          </div>
          <OpenBook
            pageKey={world}
            image={selected.image}
            imageCaption={`0${world + 1} / ${selected.label}`}
            imageTitle={selected.name}
            eyebrow={`0${world + 1} / ${selected.label}`}
            title={selected.name}
            folio={`p.0${world + 1}`}
            action={
              <button
                className="wlink"
                onClick={() => setNav?.(selected.route)}
              >
                Enter this world <ArrowUpRight size={13} />
              </button>
            }
          >
            <p>{selected.copy}</p>
          </OpenBook>
        </section>
        <section className="sec">
          <SectionHead
            eyebrow="THE PROTOCOL IN FOUR CHAPTERS"
            title={
              <>
                Read it <em>cover to cover.</em>
              </>
            }
          />
          <div className="fan">
            {chapters.map((c, i) => (
              <button
                key={c.id}
                className="ch"
                style={vars({ "--k": i })}
                onClick={() =>
                  c.id === "ownership"
                    ? setNav?.(6)
                    : c.id === "interrogate"
                      ? setNav?.(9)
                      : scroll(c.id)
                }
              >
                <span className="num">0{i + 1}</span>
                <small>CHAPTER 0{i + 1}</small>
                <h4>{c.title}</h4>
                <p>{c.copy}</p>
                <VoxelCube
                  size={26}
                  tone={(["gold", "info", "ok", "bad"] as const)[i]}
                />
              </button>
            ))}
          </div>
        </section>
        <Divider>INTERACTIVE FIELD TEST</Divider>
        <div className="sec">
          <PolicyLab />
        </div>
        <section className="sec" id="evidence">
          <SectionHead
            eyebrow="THE CHAIN DECIDES"
            title={
              <>
                Every decision, <em>a block you can open.</em>
              </>
            }
            copy="Each block opens a recorded Solana signature. Green blocks confirm transfers; red blocks record a refusal. Grant and revocation events retain their own identities."
          />
          <LedgerBlocks />
        </section>
        <section className="sec">
          <div className="pillars">
            {[
              {
                title: "Propose",
                icon: Bot,
                copy: "An autonomous agent can request an action, but it never receives unrestricted authority.",
              },
              {
                title: "Constrain",
                icon: Layers,
                copy: "The owner’s signed policy defines asset, recipient, budget, pace and time.",
              },
              {
                title: "Prove",
                icon: Fingerprint,
                copy: "Every allow or rejection leaves evidence that can be inspected independently on Solana.",
              },
            ].map((p, i) => (
              <div className="pillar" key={p.title}>
                <span className="ico">
                  <p.icon size={18} />
                </span>
                <small>0{i + 1}</small>
                <h3>{p.title}</h3>
                <p>{p.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer className="foot">
        <span>REDLINE · AUTONOMOUS FINANCE. HARD LIMITS.</span>
        <span>
          THE AGENT PROPOSES · <b>THE CHAIN DECIDES</b>
        </span>
        <span>FCCS LAB · VLU · 2026</span>
      </footer>
    </article>
  );
}

export function ArtifactAgents() {
  const wallet = useOwner() ?? "";
  // Connecting a wallet only names an address — the API cannot tell that apart
  // from a typed one, and publishing is what puts a build on a marketplace
  // under a name that gets paid. So the button waits for a signature.
  const signedIn = useSignedIn(wallet);
  const { agents, loading, error, reload } = useRealAgents();
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState("");
  const [flip, setFlip] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("v1.0.0");
  const [strategy, setStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // The detail card follows the visible rail. Without this, filtering to
  // "mine" while a stranger's agent was selected left the card showing an
  // agent that is no longer in the list beside it.
  const visibleAgents = onlyMine ? agents.filter((a) => a.isMine) : agents;
  const picked = agents.find((a) => a.id === selected);
  const agent =
    picked && visibleAgents.includes(picked) ? picked : visibleAgents[0];
  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      setNotice(
        wallet
          ? "Sign in with your wallet first — the publisher is taken from the signature, not from this form."
          : "Connect and sign in with a wallet to publish.",
      );
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const result = await api.publishAgent({
        name: name.trim(),
        version: version.trim(),
        strategy: strategy.trim(),
        modelRef: "manual:dashboard",
        codeRef: `manual:${name.trim()}`,
        config: { strategy: strategy.trim() },
      });
      await reload();
      setSelected(result.agent.id);
      setName("");
      setStrategy("");
      setNotice("Version published to the registry.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Publication failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="agents-grid">
      <aside>
        <div className="eyebrow">
          VERSIONS · {visibleAgents.length}
          {onlyMine && agents.length !== visibleAgents.length
            ? ` OF ${agents.length}`
            : ""}
        </div>
        {signedIn && (
          <button
            className="btn btn-ghost btn-sm full-button"
            aria-pressed={onlyMine}
            onClick={() => setOnlyMine((v) => !v)}
          >
            <Fingerprint size={12} />
            {onlyMine ? "Showing only mine" : "Show only mine"}
          </button>
        )}
        <div className="rail-list">
          {visibleAgents.map((a, i) => (
            <button
              className="arow2"
              style={vars({
                "--acc": [
                  "14,145,205",
                  "223,195,140",
                  "133,219,192",
                  "214,64,142",
                ][i % 4],
              })}
              key={a.id}
              aria-pressed={a.id === agent?.id}
              onClick={() => {
                setSelected(a.id);
                setFlip(false);
              }}
            >
              <span className="av">
                <Bot size={16} />
              </span>
              <span>
                <b>
                  {a.name}
                  {a.isMine && <span className="chip chip-gold">MINE</span>}
                </b>
                <small>
                  {a.version} · {short(a.agentHash, 4)}{" "}
                  <RatingBadge rating={a.rating} />
                </small>
              </span>
              <span className="n">{a.totalGrants} gr</span>
            </button>
          ))}
          {onlyMine && !visibleAgents.length && !loading && (
            <Empty>You have not published a version with this wallet.</Empty>
          )}
        </div>
        <button
          className="btn btn-ghost full-button"
          onClick={() => document.getElementById("publish-name")?.focus()}
        >
          <Plus size={12} />
          Publish agent version
        </button>
        {loading && <Empty>Loading versions…</Empty>}
        {error && (
          <p role="alert" className="error-note">
            {error}
          </p>
        )}
      </aside>
      <div>
        {agent ? (
          <>
            <div className="idstage">
              <div
                className="idcard"
                data-flip={flip}
                style={vars({ "--acc": "14,145,205" })}
                role="button"
                tabIndex={0}
                aria-label={`Flip identity card for ${agent.name}`}
                aria-pressed={flip}
                onClick={() => setFlip((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFlip((v) => !v);
                  }
                }}
              >
                <div className="face front" inert={flip}>
                  <div className="kick">
                    <span>AGENT IDENTITY · {agent.version}</span>
                    <span
                      className={`chip ${agent.activeGrants ? "chip-ok" : "chip-dim"}`}
                    >
                      {agent.activeGrants} ACTIVE GRANTS
                    </span>
                  </div>
                  <div className="avatar">
                    <VoxelCube size={52} />
                    <VoxelCube size={32} tone="info" />
                  </div>
                  <h2>
                    {agent.name}
                    <span>{agent.strategy}</span>
                  </h2>
                  <p className="help publisher-line">
                    {agent.isMine
                      ? "Published by you"
                      : agent.publisherWallet
                        ? `Published by ${short(agent.publisherWallet, 4)}`
                        : "Unclaimed — published before publishing required a signature"}
                  </p>
                  <div className="stat4">
                    {[
                      ["ACTIVE", agent.activeGrants],
                      ["TOTAL GRANTS", agent.totalGrants],
                      [
                        "SPENT",
                        `${agent.totalSpentUsdc.toLocaleString()} USDC`,
                      ],
                      ["TRANSFERS", agent.totalTx],
                    ].map(([l, v]) => (
                      <div className="stat" key={l}>
                        <small>{l}</small>
                        <b>{v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="hint">
                    <RefreshCw size={11} /> CLICK THE CARD · SEE HOW THE HASH IS
                    BUILT
                  </div>
                </div>
                <div className="face back" inert={!flip}>
                  <div className="kick">
                    <span>AGENT HASH · SHA-256 · IMMUTABLE</span>
                  </div>
                  <h3>
                    {agent.name} · {agent.version}
                  </h3>
                  <code>{agent.agentHash}</code>
                  <div className="formula">
                    <span>modelRef</span>
                    <b>+</b>
                    <span>codeRef</span>
                    <b>+</b>
                    <span>config</span>
                  </div>
                  <p className="help">
                    Every grant binds to this exact build. A change in model,
                    code reference or configuration produces a different
                    identity.
                  </p>
                  <div className="hint">
                    <RefreshCw size={11} /> CLICK TO FLIP BACK
                  </div>
                </div>
              </div>
            </div>
            <Panel
              title="Reputation"
              meta={<RatingBadge rating={agent.rating} />}
            >
              {agent.rating ? (
                <RatingDetail rating={agent.rating} />
              ) : (
                <Empty>
                  No policy decisions and no renter reviews recorded yet.
                </Empty>
              )}
            </Panel>
            <Panel
              title="Grants bound to this build"
              meta={<span className="chip chip-gold">{agent.totalGrants}</span>}
            >
              {agent.grants.length ? (
                agent.grants.map((g) => (
                  <div className="grant-mini" key={g.id}>
                    <b>{short(g.grantPda)}</b>
                    <span
                      className={`chip ${g.revoked ? "chip-bad" : "chip-ok"}`}
                    >
                      {g.revoked
                        ? "REVOKED"
                        : grantExpiresAt(g) <= Date.now()
                          ? "EXPIRED"
                          : "GRANTED"}{" "}
                      · {fmtUsdc(g.spentUnits)} /{" "}
                      {fmtUsdc(g.policyVersion.spendCapUnits)}
                    </span>
                    <div className={`bar ${g.revoked ? "bad" : ""}`}>
                      <i
                        style={{
                          width: `${Math.min(100, (Number(g.spentUnits) / Math.max(1, Number(g.policyVersion.spendCapUnits))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <Empty>No grants bound to this version.</Empty>
              )}
            </Panel>
          </>
        ) : (
          <Panel title="Agent identity">
            <Empty>
              {loading
                ? "Loading agent identity…"
                : "Publish your first version to create an identity."}
            </Empty>
          </Panel>
        )}
      </div>
      <aside>
        <Panel
          className="pubform"
          title="Publish a new version"
          meta={<span className="chip chip-dim">DRAFT</span>}
        >
          <form onSubmit={publish}>
            <label className="field">
              Name
              <input
                id="publish-name"
                className="in"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Payroll Runner"
              />
            </label>
            <label className="field">
              Version
              <input
                className="in"
                required
                maxLength={32}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
            <label className="field">
              Strategy
              <textarea
                className="in"
                required
                rows={4}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="Weekly contributor payouts against the signed allowlist…"
              />
            </label>
            <div className="inset hash-preview">
              <small>IDENTITY INPUT</small>
              <code>sha256(modelRef | codeRef | config)</code>
            </div>
            <button
              className="btn btn-gold full-button"
              disabled={busy || !signedIn}
              title={
                !wallet
                  ? "Connect a wallet to publish"
                  : !signedIn
                    ? "Sign in with your wallet to publish"
                    : ""
              }
            >
              <Upload size={13} />
              {busy ? "Publishing…" : "Publish to registry"}
              <ArrowRight size={13} />
            </button>
            {!wallet && (
              <p className="help">Connect a wallet to publish.</p>
            )}
            {wallet && !signedIn && (
              <p className="help">
                Sign in with your wallet (top bar) — the publisher is taken
                from the signature, not from this form.
              </p>
            )}
            {notice && (
              <p className="help" role="status">
                {notice}
              </p>
            )}
          </form>
        </Panel>
      </aside>
    </div>
  );
}

export function ArtifactAnalytics() {
  const { data, error, owner } = useAnalytics();
  const kpis = [
    [
      "Confirmed volume",
      data ? `${data.totalVolumeUsdc.toLocaleString()} USDC` : "—",
    ],
    ["Active grants", data?.activeGrants ?? "—"],
    [
      "Success rate",
      data?.successRatePct == null ? "—" : `${data.successRatePct}%`,
    ],
    [
      "Decision latency",
      data?.avgDecisionLatencyMs == null
        ? "—"
        : `${data.avgDecisionLatencyMs} ms`,
    ],
  ];
  return (
    <div className="analytics-bento">
      <div className="analytics-scope chip chip-info">
        {owner ? "CONNECTED OWNER" : "PROTOCOL OVERVIEW"}
      </div>
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      <div className="kpi-row">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>Recorded state</span>
          </div>
        ))}
      </div>
      <Panel
        className="volume-panel"
        title="Confirmed volume"
        meta={<span className="chip chip-gold">LAST 7 DAYS</span>}
      >
        <div className="chart-stage">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.weeklyVolume ?? []}>
              <defs>
                <linearGradient
                  id="artifact-volume"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#dfc38c" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#dfc38c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" stroke="#9fadc3" fontSize={11} />
              <YAxis stroke="#9fadc3" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#121c30",
                  borderColor: "#43516a",
                  color: "#f2eee5",
                }}
              />
              <Area
                dataKey="volumeUsdc"
                name="USDC"
                type="monotone"
                fill="url(#artifact-volume)"
                stroke="#dfc38c"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel className="outcome-panel" title="Policy outcomes">
        <div className="outcome-orbit">
          <VoxelCube size={66} tone="ok" />
          <strong>{data?.totalTransactions ?? "—"}</strong>
          <small>CONFIRMED TRANSFERS</small>
        </div>
        <div className="metric-line">
          <span>Rejected by policy</span>
          <b>{data?.totalRejections ?? "—"}</b>
        </div>
        <div className="metric-line">
          <span>Signed grants</span>
          <b>{data?.totalGrants ?? "—"}</b>
        </div>
      </Panel>
      <Panel
        className="ranking-panel"
        title="Agents by confirmed volume"
        meta={<span className="chip chip-info">REAL TRANSFERS</span>}
      >
        {data?.topAgentsByVolume.length ? (
          data.topAgentsByVolume.map((a, i) => (
            <div className="ranking-row" key={`${a.name}-${i}`}>
              <span className="av">
                <Bot size={16} />
              </span>
              <span>
                <b>{a.name}</b>
                <small>{a.grants} grants</small>
              </span>
              <strong>{a.volumeUsdc.toLocaleString()} USDC</strong>
              <div className="bar">
                <i
                  style={{
                    width: `${(a.volumeUsdc / Math.max(1, data.totalVolumeUsdc)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <Empty>No confirmed volume recorded yet.</Empty>
        )}
      </Panel>
      <Panel className="daily-panel" title="Daily settlement">
        <div className="chart-stage small-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.weeklyVolume ?? []}>
              <XAxis dataKey="t" stroke="#9fadc3" fontSize={10} />
              <Tooltip
                contentStyle={{ background: "#121c30", borderColor: "#43516a" }}
              />
              <Bar dataKey="volumeUsdc" fill="#8dcced" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

const isRejected = (row: AuditRow) => /reject|fail|deny/.test(row.eventType) || row.payload.allow === false;

export function ArtifactAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [selected, setSelected] = useState<AuditRow | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [limit, setLimit] = useState(100);
  const load = useCallback(async () => {
    try {
      setRows(
        (await api.audit()).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load events");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  const filtered = rows.filter(
    (r) =>
      (kind === "all" ||
        (kind === "chain"
          ? r.eventType.startsWith("chain.")
          : kind === "rejected"
            ? isRejected(r)
            : r.actorType === "owner")) &&
      `${r.eventType} ${r.subjectId} ${r.chainSignature} ${JSON.stringify(r.payload)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="audit-workspace">
      <div className="kpi-row">
        {[
          ["Total events", rows.length],
          ["On-chain signatures", rows.filter((r) => r.chainSignature).length],
          ["Owner actions", rows.filter((r) => r.actorType === "owner").length],
          [
            "Rejected / failed",
            rows.filter((r) => isRejected(r)).length,
          ],
        ].map(([label, value]) => (
          <div className="kpi" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="audit-toolbar">
        <label className="search">
          <Search size={15} />
          <input
            aria-label="Search audit events"
            placeholder="Search signatures, events, reason codes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="pill-row">
          {["all", "chain", "owner", "rejected"].map((k) => (
            <button
              className="btn btn-ghost btn-sm"
              key={k}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => void load()}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <div className="audit-columns">
        <Panel
          title="Chain event stream"
          meta={
            <span className="chip chip-info">{filtered.length} EVENTS</span>
          }
        >
          {loading ? (
            <Empty>Loading the ledger…</Empty>
          ) : filtered.length ? (
            filtered.slice(0, limit).map((r) => (
              <button
                className={`event-row ${selected?.id === r.id ? "selected" : ""}`}
                key={r.id}
                onClick={() => setSelected(r)}
              >
                <time>{new Date(r.createdAt).toLocaleTimeString()}</time>
                <span
                  className={`event-node ${isRejected(r) ? "bad" : ""}`}
                >
                  <VoxelCube
                    size={16}
                    tone={isRejected(r) ? "bad" : "ok"}
                  />
                </span>
                <span>
                  <b>{r.eventType}</b>
                  <small>
                    {r.actorType} · {r.subjectType} · {short(r.subjectId, 5)}
                  </small>
                </span>
                <span className="chip chip-dim">
                  {r.chainSignature ? "CHAIN" : "SERVER"}
                </span>
                <ArrowUpRight size={13} />
              </button>
            ))
          ) : (
            <Empty>No events match these filters.</Empty>
          )}
          {filtered.length > limit && (
            <button
              className="btn btn-ghost full-button"
              onClick={() => setLimit((n) => n + 100)}
            >
              Load more events
            </button>
          )}
        </Panel>
        <Panel title="Inspect the evidence" meta={<Fingerprint size={17} />}>
          {selected ? (
            <>
              <span className="chip chip-gold">{selected.eventType}</span>
              <div className="metric-line">
                <span>Recorded</span>
                <b>{new Date(selected.createdAt).toLocaleString()}</b>
              </div>
              <div className="metric-line">
                <span>Actor</span>
                <b>{selected.actorType}</b>
              </div>
              <code className="hash-preview">{selected.subjectId}</code>
              <pre className="payload-view">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
              {selected.chainSignature && (
                <a
                  className="btn btn-gold full-button"
                  target="_blank"
                  rel="noreferrer"
                  href={explorerTransactionUrl(selected.chainSignature)}
                >
                  Open on Solana Explorer <ArrowUpRight size={13} />
                </a>
              )}
            </>
          ) : (
            <Empty>
              <Fingerprint size={32} />
              <p>
                Select an event to inspect its recorded payload and transaction
                signature.
              </p>
            </Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function LedgerBlocks() {
  const [events, setEvents] = useState<AuditRow[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .audit()
        .then((rows) => {
          if (live) {
            const seen = new Set<string>();
            setEvents(
              rows
                .filter((r) => { if (!r.chainSignature || seen.has(r.chainSignature)) return false; seen.add(r.chainSignature); return true; })
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 12),
            );
            setError("");
          }
        })
        .catch(() => {
          if (live)
            setError("The chain record is unavailable. Open Audit to retry.");
        });
    void load();
    const timer = setInterval(load, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="ledger3d">
      <div className="ledger-floor" />
      {events.length ? (
        <div className="track">
          {events.map((event, i) => {
            const bad = isRejected(event),
              grant = /grant/i.test(event.eventType),
              revoke = /revok/i.test(event.eventType);
            return (
              <a
                className="blk"
                key={event.id}
                href={explorerTransactionUrl(event.chainSignature!)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${event.eventType} on Solana Explorer`}
              >
                <VoxelCube
                  size={74}
                  tone={bad ? "bad" : revoke ? "info" : grant ? "gold" : "ok"}
                  label={revoke ? "R" : grant ? "G" : bad ? "!" : "✓"}
                />
                <div className="meta">
                  <b>{short(event.chainSignature!, 5)}</b>
                  {event.eventType}
                </div>
                {i < events.length - 1 && (
                  <div className="chain">
                    {[0, 1, 2, 3, 4].map((k) => (
                      <i key={k} style={vars({ "--k": k })} />
                    ))}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      ) : (
        <Empty>{error || "No signed chain events are available yet."}</Empty>
      )}
    </div>
  );
}
