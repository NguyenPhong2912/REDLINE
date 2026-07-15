"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  Bot,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Percent,
  ChevronRight,
  Star,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { portfolio, transactions } from "@/lib/mock-data";
import { useStore } from "@/store/useStore";
import { formatTimeAgo, getCategoryColor } from "@/lib/utils";

// Portfolio value over time mock data
const portfolioHistory = Array.from({ length: 30 }, (_, i) => {
  const date = new Date("2026-06-16T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + i);
  return {
    date: date.toISOString().split("T")[0],
    value: Number((0.31 + i * 0.004 + Math.sin(i / 4) * 0.012).toFixed(3)),
  };
});

const pieData = portfolio.map((p) => ({
  name: p.agentName,
  value: p.currentValue,
  color: getCategoryColor(p.category),
}));

function createStatCards(activeAgents: number, runs: number, transactionCount: number) {
  return [
  {
    label: "Portfolio Value",
    value: "0.48 SOL",
    change: "+12.4%",
    positive: true,
    icon: <Wallet className="w-5 h-5" />,
    color: "#14b87a",
  },
  {
    label: "Total ROI",
    value: "+14.3%",
    change: "+2.1%",
    positive: true,
    icon: <Percent className="w-5 h-5" />,
    color: "#10b981",
  },
  {
    label: "Active Agents",
    value: activeAgents.toString(),
    change: activeAgents > 0 ? "Ready" : "None",
    positive: true,
    icon: <Bot className="w-5 h-5" />,
    color: "#e5a33b",
  },
  {
    label: "Agent Runs",
    value: runs.toString(),
    change: `${transactionCount} tx`,
    positive: true,
    icon: <Activity className="w-5 h-5" />,
    color: "#06b6d4",
  },
  ];
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const runtimeTransactions = useStore((state) => state.runtimeTransactions);
  const agentRuns = useStore((state) => state.agentRuns);
  const accessGrants = useStore((state) => state.accessGrants);
  const allTransactions = [...runtimeTransactions, ...transactions];
  const statCards = createStatCards(
    Math.max(accessGrants.length, portfolio.length),
    agentRuns.length,
    allTransactions.length,
  );

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p className="text-text-muted text-sm">Welcome back! Here&apos;s your portfolio overview.</p>
          </div>
          <Link href="/create" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            <span>Create Agent</span>
          </Link>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-lg bg-surface border border-border card-hover"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${stat.color}15`,
                    color: stat.color,
                  }}
                >
                  {stat.icon}
                </div>
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${
                    stat.positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {stat.positive ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Portfolio Value Chart */}
          <div className="lg:col-span-2 rounded-lg bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Portfolio Value</h3>
              <div className="flex gap-1">
                {["7d", "30d", "90d", "1y"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      timeRange === range
                        ? "bg-primary/15 text-primary-hover"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={portfolioHistory}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b87a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b87a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2e2e3e" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{
                      background: "#1e1e2e",
                      border: "1px solid #2e2e3e",
                      borderRadius: "12px",
                      color: "#f1f5f9",
                    }}
                    formatter={(value) => [`${Number(value).toFixed(3)} SOL`, "Value"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#14b87a" strokeWidth={2} fill="url(#portfolioGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Portfolio Allocation */}
          <div className="rounded-lg bg-surface border border-border p-6">
            <h3 className="font-semibold mb-4">Allocation</h3>
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1e1e2e",
                      border: "1px solid #2e2e3e",
                      borderRadius: "12px",
                      color: "#f1f5f9",
                    }}
                    formatter={(value) => [`${Number(value).toFixed(3)} SOL`, "Value"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-text-secondary text-xs">{item.name}</span>
                  </div>
                  <span className="font-medium text-xs">{item.value.toFixed(2)} SOL</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Agents */}
          <div className="rounded-lg bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">My Agents</h3>
              <Link href="/marketplace" className="text-xs text-primary-hover hover:text-primary flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {portfolio.map((item) => {
                const isPositive = item.roi > 0;
                return (
                  <Link key={item.agentId} href={`/marketplace/${item.agentId}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{
                          background: `linear-gradient(135deg, ${getCategoryColor(item.category)}, ${getCategoryColor(item.category)}cc)`,
                        }}
                      >
                        {item.agentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.agentName}</p>
                        <p className="text-xs text-text-muted capitalize">{item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{item.currentValue.toFixed(2)} SOL</p>
                        <p className={`text-xs font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                          {isPositive ? "+" : ""}{item.roi.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="rounded-lg bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Transactions</h3>
            </div>
            <div className="space-y-3">
              {allTransactions.slice(0, 5).map((tx) => {
                const isDebit = tx.type === "purchase" || tx.type === "run" || tx.type === "register";
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isDebit ? "bg-primary-dim text-primary-hover" : tx.type === "payout" ? "bg-success-dim text-success" : "bg-accent-dim text-accent"
                      }`}
                    >
                      {isDebit ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : tx.type === "payout" ? (
                        <Star className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate capitalize">
                        {tx.type} — {tx.agentName}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formatTimeAgo(tx.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                        {isDebit ? "-" : "+"}{tx.amount} {tx.token}
                      </p>
                      <span className={`badge text-[9px] ${tx.status === "confirmed" ? "badge-success" : tx.status === "pending" ? "badge-warning" : "badge-danger"}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
