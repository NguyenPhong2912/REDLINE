"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Bot,
  TrendingUp,
  ArrowRight,
  Star,
  Shield,
  Coins,
  BarChart3,
  Image as ImageIcon,
  MessageCircle,
  Vote,
  Wrench,
  Sparkles,
  ChevronRight,
  Globe,
  Lock,
  Cpu,
  Users,
} from "lucide-react";
import AgentCard from "@/components/marketplace/AgentCard";
import { agents, creators, marketStats, categories } from "@/lib/mock-data";
import { formatNumber, formatToken } from "@/lib/utils";

const categoryIcons: Record<string, React.ReactNode> = {
  Coins: <Coins className="w-6 h-6" />,
  TrendingUp: <TrendingUp className="w-6 h-6" />,
  Image: <ImageIcon className="w-6 h-6" />,
  BarChart3: <BarChart3 className="w-6 h-6" />,
  Shield: <Shield className="w-6 h-6" />,
  MessageCircle: <MessageCircle className="w-6 h-6" />,
  Vote: <Vote className="w-6 h-6" />,
  Wrench: <Wrench className="w-6 h-6" />,
};

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return count;
}

function StatCounter({ value, label, prefix = "", suffix = "" }: { value: number; label: string; prefix?: string; suffix?: string }) {
  const count = useCounter(value);
  return (
    <div className="text-center">
      <p className="text-3xl md:text-4xl font-bold text-white">
        {prefix}{formatNumber(count)}{suffix}
      </p>
      <p className="text-sm text-slate-300 mt-1">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const featuredAgents = agents.slice(0, 4);
  const topCreators = creators.slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* ==================== HERO ==================== */}
      <section className="relative min-h-[78vh] flex items-center overflow-hidden border-b border-border bg-black">
        <Image
          src="/agentx-hero.png"
          alt="Modular AI agents exchanging access passes across a technical ledger"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 border border-white/15 mb-8 backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4 text-primary-hover" />
              <span className="text-sm font-medium text-primary-hover">
                Functional Solana Devnet prototype
              </span>
            </motion.div>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 text-white"
            >
              AgentX
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-slate-200 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Discover, test, and monetize AI agents with transparent access,
              payments, and creator attribution settled on Solana.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link
                href="/marketplace"
                className="btn-primary text-base px-8 py-3.5 flex items-center gap-2 group"
                id="hero-explore-btn"
              >
                <span>Explore Marketplace</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/create"
                className="btn-secondary text-base px-8 py-3.5 flex items-center gap-2"
                id="hero-create-btn"
              >
                <Bot className="w-5 h-5" />
                <span>Create Agent</span>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-3xl mx-auto"
            >
              <StatCounter value={marketStats.totalAgents} label="Seed Agents" />
              <StatCounter value={marketStats.totalVolume} label="Demo Volume (SOL)" prefix="" />
              <StatCounter value={marketStats.activeUsers} label="Sample Users" />
              <StatCounter value={categories.length} label="Workflows" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURED AGENTS ==================== */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Featured <span className="text-gradient">Agents</span>
              </h2>
              <p className="text-text-muted mt-2">Curated seed agents for testing the complete marketplace flow</p>
            </div>
            <Link
              href="/marketplace"
              className="hidden sm:flex items-center gap-2 text-sm text-primary-hover hover:text-primary transition-colors group"
            >
              View All
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredAgents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/marketplace" className="btn-secondary inline-flex items-center gap-2">
              View All Agents <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ==================== CATEGORIES ==================== */}
      <section className="py-20 bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Browse by <span className="text-gradient">Category</span>
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Compare focused Solana workflows across eight specialized categories
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                viewport={{ once: true }}
              >
                <Link href={`/marketplace?category=${cat.id}`} id={`category-${cat.id}`}>
                  <div className="group p-5 rounded-lg bg-surface border border-border hover:border-opacity-0 card-hover relative overflow-hidden">
                    {/* Hover gradient */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: `linear-gradient(135deg, ${cat.color}10, transparent)`,
                      }}
                    />
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                        style={{
                          background: `${cat.color}20`,
                          color: cat.color,
                        }}
                      >
                        {categoryIcons[cat.icon]}
                      </div>
                      <h3 className="font-semibold text-text-primary mb-1">{cat.name}</h3>
                      <p className="text-xs text-text-muted line-clamp-2 mb-2">{cat.description}</p>
                      <p className="text-xs font-medium" style={{ color: cat.color }}>
                        {cat.agentCount} agents
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              How It <span className="text-gradient">Works</span>
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Get started with AI agents in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Globe className="w-7 h-7" />,
                title: "Discover",
                description: "Compare agent scope, evidence policy, pricing, audit status, and sample performance before granting access.",
                color: "#14b87a",
                step: "01",
              },
              {
                icon: <Lock className="w-7 h-7" />,
                title: "Connect & Unlock",
                description: "Connect a Wallet Standard wallet and purchase access through a transparent Solana transaction.",
                color: "#06b6d4",
                step: "02",
              },
              {
                icon: <Cpu className="w-7 h-7" />,
                title: "Run & Monitor",
                description: "Run the agent with user-controlled permissions, inspect evidence, and review activity from one dashboard.",
                color: "#06b6d4",
                step: "03",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="p-8 rounded-lg bg-surface border border-border card-hover text-center">
                  {/* Step number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: item.color }}
                  >
                    {item.step}
                  </div>
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-5 transition-transform group-hover:scale-110"
                    style={{
                      background: `${item.color}15`,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:items-start">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-accent">Marketplace economics</p>
              <h2 className="text-3xl font-bold">Aligned incentives for useful agents</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-text-muted">
                AgentX focuses first on Solana teams that need repeatable research and risk workflows, with access terms visible before payment.
              </p>
            </div>
            <div className="grid gap-0 border-y border-border sm:grid-cols-3 sm:border-y-0">
              {[
                {
                  icon: <Users className="h-5 w-5" />,
                  title: "Demand",
                  text: "Protocol operators, analysts, traders, and research teams buying bounded workflows.",
                },
                {
                  icon: <Bot className="h-5 w-5" />,
                  title: "Supply",
                  text: "Agent creators packaging expertise with explicit capabilities and evidence limits.",
                },
                {
                  icon: <Coins className="h-5 w-5" />,
                  title: "Revenue",
                  text: "Configurable settlement fee across one-time, subscription, and per-run access.",
                },
              ].map((item) => (
                <div key={item.title} className="border-b border-border py-5 last:border-b-0 sm:border-b-0 sm:border-l sm:px-6 sm:py-2">
                  <span className="mb-3 block text-success">{item.icon}</span>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-text-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== TOP CREATORS ==================== */}
      <section className="py-20 bg-surface/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Top <span className="text-gradient">Creators</span>
              </h2>
              <p className="text-text-muted mt-2">Sample creator supply used by the prototype catalog</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCreators.map((creator, i) => (
              <motion.div
                key={creator.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-4 p-4 rounded-lg bg-surface border border-border card-hover">
                  <div className="relative">
                    <div className="text-xl font-bold text-text-muted absolute -top-2 -left-2 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-xs">
                      {i + 1}
                    </div>
                    <Image
                      src={creator.avatar}
                      alt={creator.name}
                      width={48}
                      height={48}
                      unoptimized
                      className="w-12 h-12 rounded-lg"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-sm truncate">{creator.name}</h3>
                      {creator.verified && (
                        <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-text-muted">{creator.agentCount} agents</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-400">
                      {formatToken(creator.totalEarnings, "SOL")}
                    </p>
                    <div className="flex items-center gap-0.5 justify-end">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-text-muted">{creator.rating}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-lg overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 animated-gradient opacity-90" />
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: "30px 30px",
              }}
            />

            <div className="relative py-16 px-8 md:px-16 text-center">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                Ready to Build Your AI Agent?
              </h2>
              <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
                Publish a draft, test its runtime, and validate pricing before on-chain registration.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/create"
                  className="px-8 py-3.5 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all flex items-center gap-2 group"
                  id="cta-create-btn"
                >
                  Start Creating
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/marketplace"
                  className="px-8 py-3.5 rounded-lg bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all"
                >
                  Browse Agents
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
