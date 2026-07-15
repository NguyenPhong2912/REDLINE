"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, Users, TrendingUp, Shield, Zap } from "lucide-react";
import type { Agent } from "@/types";
import { formatNumber, formatToken, getCategoryColor } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
  index?: number;
}

export default function AgentCard({ agent, index = 0 }: AgentCardProps) {
  const categoryColor = getCategoryColor(agent.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/marketplace/${agent.id}`} id={`agent-card-${agent.id}`}>
        <div className="group relative h-full overflow-hidden rounded-lg border border-border bg-surface card-hover">
          {/* Gradient Border on Hover */}
          <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${categoryColor}20, transparent, ${categoryColor}10)`,
            }}
          />

          {/* Header */}
          <div className="relative p-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Agent Avatar */}
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}cc)`,
                    boxShadow: `0 4px 15px ${categoryColor}40`,
                  }}
                >
                  {agent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary group-hover:text-primary-hover transition-colors line-clamp-1">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    by {agent.creator.name}
                    {agent.creator.verified && (
                      <Shield className="w-3 h-3 text-primary" />
                    )}
                  </p>
                </div>
              </div>

              {/* Audit Badge */}
              {agent.auditStatus === "verified" && (
                <div className="badge badge-success text-[10px]">
                  <Shield className="w-3 h-3" /> Reviewed
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-text-muted line-clamp-2 leading-relaxed mb-4">
              {agent.description}
            </p>

            {/* Category & Chain */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="badge text-[10px]"
                style={{
                  background: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                {agent.category.toUpperCase()}
              </span>
              <span className="badge bg-surface-hover text-text-muted text-[10px] uppercase">
                {agent.chain}
              </span>
              <span className="badge bg-surface-hover text-text-muted text-[10px] uppercase">
                {agent.cluster}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-md bg-background/50">
                <div className="flex items-center justify-center gap-1 text-emerald-400 font-semibold text-sm">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {agent.roi > 0 ? `+${agent.roi.toFixed(1)}%` : "N/A"}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">ROI</p>
              </div>
              <div className="text-center p-2 rounded-md bg-background/50">
                <div className="flex items-center justify-center gap-1 text-text-primary font-semibold text-sm">
                  <Users className="w-3.5 h-3.5 text-text-muted" />
                  {formatNumber(agent.totalUsers)}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">Users</p>
              </div>
              <div className="text-center p-2 rounded-md bg-background/50">
                <div className="flex items-center justify-center gap-1 text-amber-400 font-semibold text-sm">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {agent.rating}
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">Rating</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-background/30 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-text-primary">
                {agent.price === 0
                  ? "Free"
                  : formatToken(agent.price, agent.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Zap className="w-3 h-3" />
              {agent.responseTime}ms
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
