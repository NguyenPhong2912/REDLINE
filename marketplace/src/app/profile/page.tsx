"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWalletConnection } from "@solana/react-hooks";
import { motion } from "framer-motion";
import {
  Bot,
  Calendar,
  Check,
  Coins,
  Copy,
  Edit,
  ExternalLink,
  MapPin,
  Shield,
  Star,
  Users,
} from "lucide-react";
import AgentCard from "@/components/marketplace/AgentCard";
import { creators } from "@/lib/mock-data";
import { formatDate, formatToken, truncateAddress } from "@/lib/utils";
import { useMarketplaceAgents, useStore } from "@/store/useStore";

export default function ProfilePage() {
  const { wallet } = useWalletConnection();
  const walletAddress = wallet?.account.address.toString();
  const profile = useStore((state) => state.profile);
  const allAgents = useMarketplaceAgents();
  const [copied, setCopied] = useState(false);
  const fallbackCreator = creators[0];
  const activeAddress = walletAddress ?? fallbackCreator.address;
  const userAgents = allAgents.filter(
    (agent) => agent.creator.address === activeAddress,
  );
  const ratings = userAgents.filter((agent) => agent.rating > 0);
  const averageRating = ratings.length
    ? ratings.reduce((sum, agent) => sum + agent.rating, 0) / ratings.length
    : 0;
  const totalUsers = userAgents.reduce((sum, agent) => sum + agent.totalUsers, 0);
  const totalEarnings = userAgents.reduce(
    (sum, agent) => sum + agent.price * Math.max(1, agent.totalUsers),
    0,
  );
  const joinedAt = fallbackCreator.id ? "2025-06-15T00:00:00Z" : new Date().toISOString();
  const avatar = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${activeAddress}`;

  async function copyAddress() {
    await navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 overflow-hidden rounded-lg border border-border bg-surface"
        >
          <div className="h-28 bg-[linear-gradient(110deg,#101827,#12352f,#172554)] sm:h-36" />
          <div className="relative -mt-10 px-5 pb-6 sm:px-7">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <Image
                src={avatar}
                alt={profile.displayName}
                width={96}
                height={96}
                unoptimized
                className="h-20 w-20 rounded-lg border-4 border-surface bg-background sm:h-24 sm:w-24"
              />
              <div className="min-w-0 flex-1 pt-1 sm:pt-10">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{profile.displayName}</h1>
                  <Shield className="h-5 w-5 text-success" aria-label="Wallet profile" />
                  {!walletAddress && <span className="badge badge-warning">Demo profile</span>}
                </div>
                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="mb-3 flex max-w-full items-center gap-2 rounded px-1 py-1 font-mono text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  <span className="truncate">{truncateAddress(activeAddress)}</span>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <p className="max-w-2xl text-sm leading-6 text-text-secondary">{profile.bio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-muted">
                  {profile.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Joined {formatDate(joinedAt)}</span>
                  {profile.website && (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-text-primary"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <Link href="/settings" className="btn-secondary flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm sm:mt-10">
                <Edit className="h-4 w-4" /> Edit profile
              </Link>
            </div>
          </div>
        </motion.section>

        <section className="mb-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Agents", value: userAgents.length.toString(), icon: Bot, color: "text-primary-hover" },
            { label: "Gross volume", value: formatToken(totalEarnings, "SOL"), icon: Coins, color: "text-success" },
            { label: "Average rating", value: averageRating ? averageRating.toFixed(1) : "N/A", icon: Star, color: "text-warning" },
            { label: "Agent users", value: totalUsers.toLocaleString("en-US"), icon: Users, color: "text-accent" },
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-lg border border-border bg-surface p-4 sm:p-5"
              >
                <Icon className={`mb-3 h-5 w-5 ${stat.color}`} />
                <p className="text-lg font-bold sm:text-xl">{stat.value}</p>
                <p className="mt-1 text-xs text-text-muted">{stat.label}</p>
              </motion.div>
            );
          })}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Created agents</h2>
            <Link href="/create" className="text-sm font-medium text-primary-hover hover:text-primary">Create agent</Link>
          </div>
          {userAgents.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {userAgents.map((agent, index) => (
                <AgentCard key={agent.id} agent={agent} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Bot className="mx-auto h-7 w-7 text-text-muted" />
              <p className="mt-3 text-sm font-medium">No agents for this wallet yet</p>
              <Link href="/create" className="mt-2 inline-block text-sm text-primary-hover">Create the first draft</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
