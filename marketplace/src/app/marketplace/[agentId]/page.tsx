"use client";

import { use } from "react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useSolTransfer, useWalletConnection } from "@solana/react-hooks";
import {
  ArrowLeft,
  Star,
  Shield,
  Users,
  TrendingUp,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Heart,
  BarChart3,
  Activity,
  FileText,
  MessageSquare,
  ChevronRight,
  Wallet,
  ShoppingCart,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { reviews } from "@/lib/mock-data";
import { useMarketplaceAgents, useStore } from "@/store/useStore";
import { formatNumber, formatToken, formatDate, formatTimeAgo, getCategoryColor } from "@/lib/utils";

export default function AgentDetailPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const agents = useMarketplaceAgents();
  const agent = agents.find((a) => a.id === agentId);
  const agentReviews = reviews.filter((r) => r.agentId === agentId);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const { status: walletStatus, wallet } = useWalletConnection();
  const transfer = useSolTransfer();
  const grantAccess = useStore((state) => state.grantAccess);
  const addTransaction = useStore((state) => state.addTransaction);
  const addNotification = useStore((state) => state.addNotification);
  const likedAgentIds = useStore((state) => state.likedAgentIds);
  const toggleLikedAgent = useStore((state) => state.toggleLikedAgent);
  const hasAccess = useStore((state) => state.hasAccess);
  const accessGrants = useStore((state) => state.accessGrants);

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
          <p className="text-text-muted mb-4">The agent you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/marketplace" className="btn-primary">
            <span>Back to Marketplace</span>
          </Link>
        </div>
      </div>
    );
  }

  const currentAgent = agent;
  const categoryColor = getCategoryColor(agent.category);

  const walletAddress = wallet?.account.address.toString();
  const liked = likedAgentIds.includes(agent.id);
  const accessGranted = hasAccess(agent.id, walletAddress);
  const accessGrant = accessGrants.find(
    (grant) =>
      grant.agentId === agent.id && grant.ownerAddress === walletAddress,
  );
  const canTopUp =
    agent.pricingModel === "pay-per-use" ||
    agent.pricingModel === "subscription";

  const copyAddress = () => {
    navigator.clipboard.writeText(agent.listingAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function purchaseAgent() {
    setPurchaseMessage("");
    if (!walletAddress || walletStatus !== "connected") {
      setPurchaseMessage("Connect a Solana wallet before purchasing access.");
      return;
    }

    try {
      let transactionSignature: string | undefined;
      if (currentAgent.price > 0) {
        const signature = await transfer.send(
          {
            amount: BigInt(Math.round(currentAgent.price * 1_000_000_000)),
            destination: currentAgent.creator.address,
          },
          { commitment: "confirmed" },
        );
        transactionSignature = signature.toString();
        addTransaction({
          id: crypto.randomUUID(),
          type: "purchase",
          agentId: currentAgent.id,
          agentName: currentAgent.name,
          amount: currentAgent.price,
          token: currentAgent.currency,
          from: walletAddress,
          to: currentAgent.creator.address,
          signature: transactionSignature,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        });
      }

      grantAccess({
        agentId: currentAgent.id,
        ownerAddress: walletAddress,
        pricingModel: currentAgent.pricingModel,
        transactionSignature,
        transactionSignatures: transactionSignature
          ? [transactionSignature]
          : undefined,
        grantedAt: new Date().toISOString(),
        remainingRuns:
          currentAgent.pricingModel === "pay-per-use" ? 1 : undefined,
        expiresAt:
          currentAgent.pricingModel === "subscription"
            ? new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString()
            : undefined,
      });
      addNotification({
        id: crypto.randomUUID(),
        type: "success",
        title: "Access granted",
        message: `${currentAgent.name} is ready in your playground.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      setPurchaseMessage(
        currentAgent.pricingModel === "pay-per-use"
          ? "One run credit added to your account."
          : currentAgent.pricingModel === "subscription"
            ? "Thirty days of access were added to your account."
            : "Access confirmed. You can now run this agent.",
      );
    } catch (error) {
      setPurchaseMessage(
        error instanceof Error
          ? error.message
          : "The transaction was cancelled or could not be confirmed.",
      );
    }
  }

  async function shareAgent() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: currentAgent.name,
        text: currentAgent.description,
        url,
      });
      return;
    }
    await navigator.clipboard.writeText(url);
    setPurchaseMessage("Agent link copied to clipboard.");
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "performance", label: "Performance", icon: <Activity className="w-4 h-4" /> },
    { id: "contract", label: "Contract", icon: <FileText className="w-4 h-4" /> },
    { id: "reviews", label: `Reviews (${agentReviews.length})`, icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-text-muted mb-6"
        >
          <Link href="/marketplace" className="hover:text-text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-text-primary">{agent.name}</span>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid lg:grid-cols-3 gap-8 mb-10"
        >
          {/* Left: Agent Info */}
          <div className="lg:col-span-2">
            <div className="flex items-start gap-5 mb-6">
              <div
                className="w-20 h-20 rounded-lg flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}cc)`,
                  boxShadow: `0 8px 25px ${categoryColor}40`,
                }}
              >
                {agent.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold">{agent.name}</h1>
                  {agent.auditStatus === "verified" && (
                    <span className="badge badge-success">
                      <Shield className="w-3.5 h-3.5" /> Reviewed
                    </span>
                  )}
                  <span className={`badge ${agent.verifiedOnChain ? "badge-success" : "badge-warning"}`}>
                    {agent.verifiedOnChain ? "On-chain" : "Prototype"}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-sm text-text-muted mb-3">
                  <span className="flex items-center gap-1">
                    by{" "}
                    <span className="text-text-primary font-medium">{agent.creator.name}</span>
                    {agent.creator.verified && <Shield className="w-3 h-3 text-primary" />}
                  </span>
                  <span
                    className="badge text-[10px]"
                    style={{ background: `${categoryColor}20`, color: categoryColor }}
                  >
                    {agent.category.toUpperCase()}
                  </span>
                  <span className="badge bg-surface-hover text-text-muted text-[10px]">
                    {agent.chain}
                  </span>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  {agent.longDescription}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "ROI",
                  value: agent.roi > 0 ? `+${agent.roi.toFixed(1)}%` : "N/A",
                  icon: <TrendingUp className="w-4 h-4" />,
                  color: "text-emerald-400",
                },
                {
                  label: "Users",
                  value: formatNumber(agent.totalUsers),
                  icon: <Users className="w-4 h-4" />,
                  color: "text-text-primary",
                },
                {
                  label: "Rating",
                  value: agent.rating.toString(),
                  icon: <Star className="w-4 h-4 fill-amber-400 text-amber-400" />,
                  color: "text-amber-400",
                },
                {
                  label: "Response",
                  value: `${agent.responseTime}ms`,
                  icon: <Zap className="w-4 h-4" />,
                  color: "text-cyan-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 rounded-lg bg-surface border border-border text-center"
                >
                  <div className={`flex items-center justify-center gap-1.5 ${stat.color} font-bold text-xl mb-1`}>
                    {stat.icon}
                    {stat.value}
                  </div>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Purchase Card */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-surface border border-border p-6 sticky top-24">
              <div className="mb-5">
                <p className="text-sm text-text-muted mb-1">Price</p>
                <p className="text-3xl font-bold">
                  {agent.price === 0 ? (
                    <span className="text-emerald-400">Free</span>
                  ) : (
                    formatToken(agent.price, agent.currency)
                  )}
                </p>
                <p className="text-sm text-text-muted capitalize">{agent.pricingModel}</p>
              </div>

              {!agent.verifiedOnChain && agent.price > 0 && (
                <p className="mb-4 rounded-md border border-warning/30 bg-warning-dim p-3 text-xs leading-5 text-warning">
                  Prototype settlement: the wallet sends SOL directly to the creator and access is stored locally.
                </p>
              )}

              <button
                type="button"
                onClick={purchaseAgent}
                disabled={transfer.isSending || (accessGranted && !canTopUp)}
                className="w-full btn-primary py-3.5 text-base flex items-center justify-center gap-2 mb-3"
                id="buy-agent-btn"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>
                  {accessGranted && !canTopUp
                    ? "Access granted"
                    : transfer.isSending
                      ? "Confirming..."
                      : agent.price === 0
                        ? "Unlock free agent"
                        : agent.pricingModel === "pay-per-use"
                          ? "Buy one run"
                          : agent.pricingModel === "subscription"
                            ? "Add 30 days"
                            : "Purchase access"}
                </span>
              </button>

              {accessGrant?.remainingRuns !== undefined && (
                <p className="mb-3 text-center text-xs text-text-muted">
                  {accessGrant.remainingRuns} run credit{accessGrant.remainingRuns === 1 ? "" : "s"} remaining
                </p>
              )}
              {accessGrant?.expiresAt && (
                <p className="mb-3 text-center text-xs text-text-muted">
                  Access until {formatDate(accessGrant.expiresAt)}
                </p>
              )}

              <Link
                href={`/playground?agent=${agent.id}`}
                className="w-full btn-secondary py-3 text-sm flex items-center justify-center gap-2 mb-5"
              >
                <Wallet className="w-4 h-4" />
                {accessGranted || agent.pricingModel === "free" ? "Open playground" : "Preview in playground"}
              </Link>

              {purchaseMessage && (
                <p className="mb-4 rounded-md border border-border bg-background p-3 text-xs text-text-secondary">
                  {purchaseMessage}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLikedAgent(agent.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-sm transition-all ${
                    liked
                      ? "bg-danger-dim border-danger/30 text-danger"
                      : "bg-surface border-border text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-danger" : ""}`} />
                  {liked ? "Liked" : "Like"}
                </button>
                <button
                  type="button"
                  onClick={shareAgent}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border text-sm text-text-muted hover:text-text-primary bg-surface transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {/* Agent Info */}
              <div className="mt-5 pt-5 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Success Rate</span>
                  <span className="font-medium text-emerald-400">{agent.successRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Total Transactions</span>
                  <span className="font-medium">{formatNumber(agent.totalTransactions)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Reviews</span>
                  <span className="font-medium">{agent.reviewCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Created</span>
                  <span className="font-medium">{formatDate(agent.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Updated</span>
                  <span className="font-medium">{formatTimeAgo(agent.updatedAt)}</span>
                </div>
              </div>

              {/* Capabilities */}
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  Capabilities
                </p>
                <div className="flex flex-wrap gap-2">
                  {agent.capabilities.map((cap) => (
                    <span key={cap} className="badge bg-surface-hover text-text-muted text-[10px]">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="border-b border-border mb-8">
          <div className="flex gap-0 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary-hover"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="lg:w-2/3">
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold mb-3">About {agent.name}</h3>
                <p className="text-text-secondary leading-relaxed">{agent.longDescription}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-text-muted">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "performance" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* ROI Chart */}
              <div className="rounded-lg bg-surface border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">ROI (30 Days)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={agent.performance}>
                      <defs>
                        <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b87a" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#14b87a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                      <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <Tooltip
                        contentStyle={{
                          background: "#1e1e2e",
                          border: "1px solid #2e2e3e",
                          borderRadius: "12px",
                          color: "#f1f5f9",
                        }}
                        formatter={(value) => [`${Number(value).toFixed(1)}%`, "ROI"]}
                      />
                      <Area type="monotone" dataKey="roi" stroke="#14b87a" strokeWidth={2} fill="url(#roiGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume Chart */}
              <div className="rounded-lg bg-surface border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Transaction Volume (30 Days)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agent.performance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(v) => v.slice(5)} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: "#1e1e2e",
                          border: "1px solid #2e2e3e",
                          borderRadius: "12px",
                          color: "#f1f5f9",
                        }}
                        formatter={(value) => [`${Number(value).toFixed(2)} SOL`, "Volume"]}
                      />
                      <Bar dataKey="volume" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "contract" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="rounded-lg bg-surface border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Solana Registry</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                      Derived listing PDA
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-primary-hover bg-primary-dim px-3 py-2 rounded-lg flex-1 truncate">
                        {agent.listingAddress}
                      </code>
                      <button
                        onClick={copyAddress}
                        className="p-2 rounded-lg bg-surface-hover hover:bg-border transition-colors"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                      {agent.verifiedOnChain && (
                        <a
                          href={`https://explorer.solana.com/address/${agent.listingAddress}?cluster=${agent.cluster}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-surface-hover hover:bg-border transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 text-text-muted" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Chain</p>
                      <p className="text-sm font-medium capitalize">{agent.chain} {agent.cluster}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Audit Status</p>
                      <span className={`badge ${agent.auditStatus === "verified" ? "badge-success" : "badge-warning"}`}>
                        <Shield className="w-3 h-3" />
                        {agent.auditStatus}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Program ID</p>
                    <code className="block truncate rounded-md bg-background px-3 py-2 font-mono text-xs text-text-secondary">
                      {agent.programId}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Registry State</p>
                    <span className={`badge ${agent.verifiedOnChain ? "badge-success" : "badge-warning"}`}>
                      {agent.verifiedOnChain ? "Confirmed on-chain" : "PDA derived, not deployed"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Standard</p>
                    <p className="text-sm font-medium">Anchor PDA access registry</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {agentReviews.length > 0 ? (
                agentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-5 rounded-lg bg-surface border border-border"
                  >
                    <div className="flex items-start gap-3">
                      <Image
                        src={review.userAvatar}
                        alt={review.userName}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{review.userName}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < review.rating
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-text-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-text-muted">
                            {formatTimeAgo(review.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No reviews yet</h3>
                  <p className="text-sm text-text-muted">Be the first to review this agent.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
