import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Fingerprint, Play, Sparkles } from "lucide-react";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DashboardLiveGrants } from "./DashboardLiveGrants";
import { LiveFeed } from "./LiveFeed";
import { ProtocolConsole } from "./ProtocolConsole";
import { ProtocolSpine } from "./ProtocolSpine";
import { api, type Analytics } from "../lib/api";
import type { AppClient } from "../solana/client";
import { color, mono, sans } from "../theme";
import { useT } from "../i18n/LanguageContext";
import heroArt from "../../assets/redline-celestial-vault-hero.webp";

// English is the source language here too, same as the rest of the app —
// every string below is written in English and wrapped as `tr("...")`.
const VI: Record<string, string> = {
  "Propose": "Đề xuất",
  "An autonomous agent can request an action, but it never receives unrestricted authority.":
    "Một agent tự động có thể đề xuất một hành động, nhưng nó không bao giờ được cấp quyền không giới hạn.",
  "Constrain": "Ràng buộc",
  "The owner's signed policy becomes a hard envelope around asset, recipient, budget, pace and time.":
    "Policy đã ký của chủ sở hữu trở thành một ranh giới cứng bao quanh tài sản, người nhận, ngân sách, nhịp độ và thời gian.",
  "Prove": "Chứng minh",
  "Every allow or rejection leaves evidence that can be inspected independently on Solana.":
    "Mọi lần cho phép hay từ chối đều để lại bằng chứng có thể kiểm tra độc lập trên Solana.",

  "Active policies": "Policy đang hoạt động",
  "Settled volume": "Khối lượng đã tất toán",
  "Policy blocks": "Lần policy chặn",
  "Decision latency": "Độ trễ quyết định",

  "Protection for autonomous finance": "Bảo vệ cho tài chính tự động",
  "Boundless intelligence.": "Trí tuệ không giới hạn.",
  "Protected by design.": "Được bảo vệ ngay từ thiết kế.",
  "Give AI agents room to act while REDLINE keeps every asset, recipient, budget and decision inside your signed boundaries.":
    "Cho AI agent không gian để hành động, trong khi REDLINE giữ mọi tài sản, người nhận, ngân sách và quyết định trong ranh giới bạn đã ký.",
  "Enter REDLINE": "Vào REDLINE",
  "Explore the protocol": "Khám phá giao thức",

  "Live: monitoring every transaction": "Trực tiếp: theo dõi mọi giao dịch",
  "Every proposal is checked against your signed policy before it settles on Solana.":
    "Mọi đề xuất đều được đối chiếu với policy đã ký của bạn trước khi tất toán trên Solana.",
  "Open audit trail": "Mở audit trail",

  "Discover the boundary": "Khám phá ranh giới",

  "Back to the top of Protocol": "Về đầu trang Protocol",
  "Back to Protocol": "Về Protocol",

  "Protocol chapters": "Các chương của Protocol",
  "Enforcement": "Thực thi",
  "Evidence": "Bằng chứng",
  "Ownership": "Quyền sở hữu",
  "Interrogate": "Truy vấn",

  "Protocol facts": "Số liệu Protocol",
  "Connect a wallet to scope these figures to your policies.": "Kết nối ví để giới hạn các số liệu này theo policy của bạn.",

  "Chapter 01 / Enforcement": "Chương 01 / Thực thi",
  "A transaction is a journey with seven possible exits.": "Một giao dịch là một hành trình với bảy lối ra có thể xảy ra.",
  "Continue the protocol": "Tiếp tục giao thức",
  "Chapter 02 / Evidence": "Chương 02 / Bằng chứng",

  "How REDLINE works": "REDLINE hoạt động như thế nào",

  "What the chain decided, while it is happening.": "Những gì blockchain quyết định, ngay khi nó xảy ra.",
  "Runtime logs are not the source of truth. REDLINE re-reads program events and attaches transaction signatures so every claim can be followed back to the chain.":
    "Log của runtime không phải nguồn sự thật. REDLINE đọc lại các sự kiện của chương trình và đính kèm chữ ký giao dịch để mọi khẳng định đều có thể truy ngược về blockchain.",
  "Open the full audit trail": "Mở toàn bộ audit trail",
  "Chapter 03 / Ownership": "Chương 03 / Quyền sở hữu",

  "Signed boundaries currently in force.": "Các ranh giới đã ký đang có hiệu lực.",
  "Chapter 04 / Interrogate": "Chương 04 / Truy vấn",

  "Ask it what it did, and why.": "Hỏi nó đã làm gì, và vì sao.",
  "Every figure this protocol holds is queryable. Type ": "Mọi số liệu giao thức này nắm giữ đều có thể truy vấn. Gõ ",
  " to see which": " để xem check nào",
  " check has been stopping work, ": " đang chặn hoạt động, gõ ",
  " to read what a": " để đọc ý nghĩa của một",
  " refusal meant, or ": " lần từ chối, hoặc ",
  " anything in plain language.": " bất cứ điều gì bằng ngôn ngữ tự nhiên.",
  "The assistant is handed the same recorded state you can read yourself, and nothing else. When it does not know, it says so rather than estimating.":
    "Trợ lý được cấp đúng trạng thái đã ghi nhận mà bạn có thể tự đọc, không hơn không kém. Khi không biết, nó nói rõ thay vì đoán mò.",

  "The agent proposes. The chain decides.": "Agent đề xuất. Blockchain quyết định.",
};

const principles = [
  { number: "01", title: "Propose", body: "An autonomous agent can request an action, but it never receives unrestricted authority." },
  { number: "02", title: "Constrain", body: "The owner's signed policy becomes a hard envelope around asset, recipient, budget, pace and time." },
  { number: "03", title: "Prove", body: "Every allow or rejection leaves evidence that can be inspected independently on Solana." },
];

export function ProtocolExperience({ setNav }: { setNav?: (index: number) => void }) {
  const tr = useT(VI);
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const owner = connected ? String(connected.account.address) : "";
  const [stats, setStats] = useState<Analytics | null>(null);
  const [showProtocolReturn, setShowProtocolReturn] = useState(false);
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!owner) {
      setStats(null);
      return;
    }
    let active = true;
    const load = () => api.analytics(owner).then(value => {
      if (active) setStats(value);
    }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [owner]);

  const facts = [
    [tr("Active policies"), stats ? String(stats.activeGrants) : "—"],
    [tr("Settled volume"), stats ? `${stats.totalVolumeUsdc.toLocaleString()} USDC` : "—"],
    [tr("Policy blocks"), stats ? String(stats.totalRejections) : "—"],
    [tr("Decision latency"), stats?.avgDecisionLatencyMs != null ? `${stats.avgDecisionLatencyMs} ms` : "—"],
  ];

  const chaptersRef = useRef<HTMLElement | null>(null);
  const evidenceRef = useRef<HTMLElement | null>(null);
  const ownershipRef = useRef<HTMLElement | null>(null);
  const consoleRef = useRef<HTMLElement | null>(null);
  const scrollToChapters = () =>
    chaptersRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  const scrollToChapter = (target: React.RefObject<HTMLElement | null>) =>
    target.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  const scrollToProtocol = () =>
    heroRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowProtocolReturn(!entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="protocol-experience">
      <section className="protocol-hero" ref={heroRef}>
        <motion.div
          className="protocol-hero-art-layer"
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={heroArt} alt="" width={1672} height={941} decoding="async" fetchPriority="high" />
        </motion.div>
        <div className="protocol-hero-wash" aria-hidden="true" />
        <div className="aurora-layer" aria-hidden="true" />
        {/* A traced signal path through the art, on the side the wash already
            leaves uncovered — the same "transaction's journey" this page's
            first chapter is about, just drawn once, ambiently, in the hero. */}
        <svg className="protocol-hero-wire" viewBox="0 0 1600 800" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="protocolWireGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
              <stop offset="45%" stopColor="#22d3ee" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 900,700 C 1080,620 1120,340 1340,380 C 1520,412 1580,190 1900,110" stroke="url(#protocolWireGradient)" strokeWidth="2.5" />
        </svg>
        <div className="protocol-depth-field" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </div>
        <motion.div
          className="protocol-hero-copy"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="protocol-kicker">
            <Sparkles size={12} /> {tr("Protection for autonomous finance")}
          </div>
          <h1 className="protocol-hero-title">
            <span className="protocol-title-line">{tr("Boundless intelligence.")}</span>
            <span className="protocol-title-line protocol-title-accent">{tr("Protected by design.")}</span>
          </h1>
          <p className="protocol-hero-lede">
            {tr("Give AI agents room to act while REDLINE keeps every asset, recipient, budget and decision inside your signed boundaries.")}
          </p>
          <div className="protocol-hero-actions">
            <button type="button" onClick={() => setNav?.(6)} className="protocol-primary-action btn-radiant">
              {tr("Enter REDLINE")} <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={scrollToChapters} className="protocol-text-action">
              <Play size={13} fill="currentColor" /> {tr("Explore the protocol")}
            </button>
          </div>
        </motion.div>
        <motion.div
          className="protocol-hero-live-chip"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="protocol-hero-live-dot glow-pulse-dot" aria-hidden="true" />
          <div className="protocol-hero-live-copy">
            <strong>{tr("Live: monitoring every transaction")}</strong>
            <span>{tr("Every proposal is checked against your signed policy before it settles on Solana.")}</span>
          </div>
          <button type="button" onClick={() => setNav?.(5)} className="protocol-hero-live-link">
            {tr("Open audit trail")} <ArrowUpRight size={12} />
          </button>
        </motion.div>
        {/* It looks like an affordance and reads like an instruction, so it has
            to behave like one. It was a decorative div that did nothing when
            clicked. */}
        <button type="button" className="protocol-scroll-cue" onClick={scrollToChapters}>
          {tr("Discover the boundary")} <ArrowDown size={14} />
        </button>
      </section>

      <AnimatePresence>
        {showProtocolReturn && (
          <motion.button
            type="button"
            className="protocol-return-button"
            onClick={scrollToProtocol}
            aria-label={tr("Back to the top of Protocol")}
            initial={reduced ? false : { opacity: 0, y: 10, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 8, scale: .96 }}
            transition={{ duration: reduced ? 0 : .22 }}
          >
            <ArrowUp size={15} />
            <span>{tr("Back to Protocol")}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="protocol-story">
        <nav className={`protocol-chapter-nav ${showProtocolReturn ? "is-visible" : ""}`} aria-label={tr("Protocol chapters")}>
          {[
            ["01", "Enforcement", chaptersRef],
            ["02", "Evidence", evidenceRef],
            ["03", "Ownership", ownershipRef],
            ["04", "Interrogate", consoleRef],
          ].map(([number, label, target]) => (
            <button type="button" key={String(number)} onClick={() => scrollToChapter(target as React.RefObject<HTMLElement | null>)}>
              <span>{String(number)}</span>{tr(String(label))}
            </button>
          ))}
        </nav>

        <div className="protocol-facts" aria-label={tr("Protocol facts")}>
        {facts.map(([label, value]) => (
          <div key={label} className="protocol-fact card-glow-hover">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        {!owner && <div className="protocol-facts-note">{tr("Connect a wallet to scope these figures to your policies.")}</div>}
        </div>

      <section className="protocol-chapter" ref={chaptersRef}>
        <div className="protocol-chapter-heading">
          <span>{tr("Chapter 01 / Enforcement")}</span>
          <h2>{tr("A transaction is a journey with seven possible exits.")}</h2>
        </div>
        <ProtocolSpine owner={owner || undefined} />
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(evidenceRef)}>
          <span>{tr("Continue the protocol")}</span>
          {tr("Chapter 02 / Evidence")} <ArrowDown size={14} />
        </button>
      </section>

      <section className="protocol-chapter my-12" aria-label={tr("How REDLINE works")}>
        <div className="glass-panel">
          {principles.map((principle, index) => (
            <motion.div
              key={principle.number}
              className="stage card-glow-hover"
              initial={reduced ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: reduced ? 0 : index * 0.08 }}
            >
              <div className="number">{principle.number}</div>
              <h3>{tr(principle.title)}</h3>
              <p>{tr(principle.body)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="protocol-chapter protocol-proof-chapter" ref={evidenceRef}>
        <div className="protocol-chapter-heading">
          <span>{tr("Chapter 02 / Evidence")}</span>
          <h2>{tr("What the chain decided, while it is happening.")}</h2>
        </div>
        <div className="protocol-proof-layout">
          <div className="protocol-proof-copy">
            <Fingerprint size={24} />
            <p>{tr("Runtime logs are not the source of truth. REDLINE re-reads program events and attaches transaction signatures so every claim can be followed back to the chain.")}</p>
            <button type="button" onClick={() => setNav?.(5)}>
              {tr("Open the full audit trail")} <ArrowUpRight size={13} />
            </button>
          </div>
          <LiveFeed />
        </div>
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(ownershipRef)}>
          <span>{tr("Continue the protocol")}</span>
          {tr("Chapter 03 / Ownership")} <ArrowDown size={14} />
        </button>
      </section>

      <section className="protocol-chapter protocol-live-chapter" ref={ownershipRef}>
        <div className="protocol-chapter-heading">
          <span>{tr("Chapter 03 / Ownership")}</span>
          <h2>{tr("Signed boundaries currently in force.")}</h2>
        </div>
        <DashboardLiveGrants onNavigate={() => setNav?.(6)} />
        <button type="button" className="protocol-next-chapter" onClick={() => scrollToChapter(consoleRef)}>
          <span>{tr("Continue the protocol")}</span>
          {tr("Chapter 04 / Interrogate")} <ArrowDown size={14} />
        </button>
      </section>

      {/* Last, because it answers the question the chapters above raise: fine,
          then ask it yourself. */}
      <section className="protocol-chapter protocol-console-chapter" ref={consoleRef}>
        <div className="protocol-chapter-heading">
          <span>{tr("Chapter 04 / Interrogate")}</span>
          <h2>{tr("Ask it what it did, and why.")}</h2>
        </div>
        <div className="protocol-console-layout">
          <div className="protocol-console-copy">
            <p>
              {tr("Every figure this protocol holds is queryable. Type ")}<code>gates</code>{tr(" to see which")}
              {tr(" check has been stopping work, ")}<code>explain SPEND_CAP_EXCEEDED</code>{tr(" to read what a")}
              {tr(" refusal meant, or ")}<code>ask</code>{tr(" anything in plain language.")}
            </p>
            <p>
              {tr("The assistant is handed the same recorded state you can read yourself, and nothing else. When it does not know, it says so rather than estimating.")}
            </p>
          </div>
          <ProtocolConsole owner={owner || undefined} />
        </div>
      </section>

      <footer className="protocol-footer">
        <span style={mono}>REDLINE / SOLANA DEVNET</span>
        <p style={sans}>{tr("The agent proposes. The chain decides.")}</p>
      </footer>
      </div>
    </article>
  );
}
