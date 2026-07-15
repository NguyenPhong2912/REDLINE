"use client";

import { useState } from "react";
import Image from "next/image";
import { useWalletConnection } from "@solana/react-hooks";
import { motion } from "framer-motion";
import {
  Vote,
  Users,
  Coins,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
} from "lucide-react";
import { proposals } from "@/lib/mock-data";
import { formatNumber, formatDate } from "@/lib/utils";
import { useStore } from "@/store/useStore";

const daoStats = [
  { label: "Treasury", value: "2,450 SOL", icon: <Coins className="w-5 h-5" />, color: "#14f195" },
  { label: "Token Holders", value: "12,340", icon: <Users className="w-5 h-5" />, color: "#e5a33b" },
  { label: "Proposals", value: "47", icon: <Vote className="w-5 h-5" />, color: "#06b6d4" },
  { label: "Participation", value: "68%", icon: <BarChart3 className="w-5 h-5" />, color: "#10b981" },
];

export default function DAOPage() {
  const [filter, setFilter] = useState<string>("all");
  const [votingProposal, setVotingProposal] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState("");
  const { wallet } = useWalletConnection();
  const governanceVotes = useStore((state) => state.governanceVotes);
  const castGovernanceVote = useStore((state) => state.castGovernanceVote);
  const walletAddress = wallet?.account.address.toString();

  const filteredProposals = filter === "all" ? proposals : proposals.filter((p) => p.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="badge badge-primary"><Timer className="w-3 h-3" /> Active</span>;
      case "passed":
        return <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> Passed</span>;
      case "rejected":
        return <span className="badge badge-danger"><XCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="badge bg-surface-hover text-text-muted"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return `${days}d ${hours}h remaining`;
  };

  function submitVote(proposalId: string, vote: "for" | "against") {
    if (!walletAddress) {
      setVoteMessage("Connect a Solana wallet before recording a vote.");
      return;
    }
    castGovernanceVote(proposalId, vote);
    setVotingProposal(null);
    setVoteMessage("Vote recorded in this Devnet governance preview.");
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            DAO <span className="text-gradient">Governance</span>
          </h1>
          <p className="text-text-muted">
            Review marketplace proposals and test wallet-gated voting on Devnet
          </p>
          <span className="mt-3 inline-flex badge badge-warning">Demo dataset</span>
          {voteMessage && (
            <p className="mt-3 inline-block rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
              {voteMessage}
            </p>
          )}
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {daoStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-lg bg-surface border border-border"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${stat.color}15`, color: stat.color }}
              >
                {stat.icon}
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto hide-scrollbar">
          {["all", "active", "passed", "rejected", "pending"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? "bg-primary/15 text-primary-hover"
                  : "text-text-muted hover:text-text-primary hover:bg-surface"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({proposals.filter((p) => f === "all" || p.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Proposals */}
        <div className="space-y-4">
          {filteredProposals.map((proposal, i) => {
            const recordedVote = governanceVotes[proposal.id];
            const votesFor = proposal.votesFor + (recordedVote === "for" ? 1 : 0);
            const votesAgainst = proposal.votesAgainst + (recordedVote === "against" ? 1 : 0);
            const totalVotes = proposal.totalVotes + (recordedVote ? 1 : 0);
            const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;
            const againstPercent = 100 - forPercent;
            const quorumPercent = Math.min((totalVotes / proposal.quorum) * 100, 100);

            return (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg bg-surface border border-border p-6 card-hover"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {getStatusBadge(proposal.status)}
                      <span className="badge bg-surface-hover text-text-muted text-[10px] capitalize">
                        {proposal.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{proposal.title}</h3>
                    <p className="text-sm text-text-muted line-clamp-2">
                      {proposal.description}
                    </p>
                  </div>
                </div>

                {/* Voting Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <ThumbsUp className="w-4 h-4" />
                      {formatNumber(votesFor)} ({forPercent.toFixed(1)}%)
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400 font-medium">
                      ({againstPercent.toFixed(1)}%) {formatNumber(votesAgainst)}
                      <ThumbsDown className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-background overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                      style={{ width: `${forPercent}%` }}
                    />
                    <div
                      className="h-full bg-red-500 rounded-r-full transition-all duration-500"
                      style={{ width: `${againstPercent}%` }}
                    />
                  </div>
                </div>

                {/* Quorum Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                    <span>Quorum: {formatNumber(totalVotes)} / {formatNumber(proposal.quorum)}</span>
                    <span>{quorumPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${quorumPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Image
                        src={proposal.proposerAvatar}
                        alt=""
                        width={16}
                        height={16}
                        unoptimized
                        className="h-4 w-4 rounded-full"
                      />
                      {proposal.proposer}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {proposal.status === "active" ? getTimeRemaining(proposal.endDate) : formatDate(proposal.endDate)}
                    </span>
                  </div>

                  {proposal.status === "active" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVotingProposal(votingProposal === proposal.id ? null : proposal.id)}
                        disabled={Boolean(recordedVote)}
                        className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                      >
                        <Vote className="w-3.5 h-3.5" />
                        <span>{recordedVote ? `Voted ${recordedVote}` : "Vote"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Voting Panel */}
                {votingProposal === proposal.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 pt-4 border-t border-border"
                  >
                    <p className="text-sm font-medium mb-3">Cast your vote:</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => submitVote(proposal.id, "for")}
                        className="flex-1 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <ThumbsUp className="w-4 h-4" /> For
                      </button>
                      <button
                        type="button"
                        onClick={() => submitVote(proposal.id, "against")}
                        className="flex-1 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <ThumbsDown className="w-4 h-4" /> Against
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-2 text-center">
                      This preview records one local vote per connected wallet session.
                    </p>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
