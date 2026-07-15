"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  TrendingUp,
  Clock,
  Star,
  Users,
  X,
  ChevronDown,
  Filter,
} from "lucide-react";
import AgentCard from "@/components/marketplace/AgentCard";
import { categories } from "@/lib/mock-data";
import { useMarketplaceAgents, useStore } from "@/store/useStore";
import type { AuditStatus, Chain, PricingModel } from "@/types";

const sortOptions = [
  { value: "trending", label: "Trending", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "newest", label: "Newest", icon: <Clock className="w-4 h-4" /> },
  { value: "top-rated", label: "Top Rated", icon: <Star className="w-4 h-4" /> },
  { value: "most-used", label: "Most Used", icon: <Users className="w-4 h-4" /> },
  { value: "price-low", label: "Price: Low → High", icon: <ChevronDown className="w-4 h-4" /> },
  { value: "price-high", label: "Price: High → Low", icon: <ChevronDown className="w-4 h-4 rotate-180" /> },
];

const chainOptions: Chain[] = ["solana"];
const auditOptions: AuditStatus[] = ["verified", "pending", "unaudited"];
const pricingOptions: PricingModel[] = ["free", "one-time", "subscription", "pay-per-use"];

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MarketplaceContent />
    </Suspense>
  );
}

function MarketplaceContent() {
  const agents = useMarketplaceAgents();
  const searchParams = useSearchParams();
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const category = searchParams.get("category");
    return category && categories.some((item) => item.id === category)
      ? category
      : "all";
  });
  const [selectedChain, setSelectedChain] = useState<string>("all");
  const [selectedAudit, setSelectedAudit] = useState<string>("all");
  const [selectedPricing, setSelectedPricing] = useState<string>("all");
  const [sortBy, setSortBy] = useState("trending");
  const [showFilters, setShowFilters] = useState(false);

  const filteredAgents = useMemo(() => {
    let result = [...agents];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== "all") {
      result = result.filter((a) => a.category === selectedCategory);
    }
    if (selectedChain !== "all") {
      result = result.filter((a) => a.chain === selectedChain);
    }
    if (selectedAudit !== "all") {
      result = result.filter((a) => a.auditStatus === selectedAudit);
    }
    if (selectedPricing !== "all") {
      result = result.filter((a) => a.pricingModel === selectedPricing);
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "top-rated":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "most-used":
        result.sort((a, b) => b.totalUsers - a.totalUsers);
        break;
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
      default:
        result.sort((a, b) => b.totalTransactions - a.totalTransactions);
    }

    return result;
  }, [agents, searchQuery, selectedCategory, selectedChain, selectedAudit, selectedPricing, sortBy]);

  const activeFilters = [
    selectedCategory !== "all" && { key: "category", value: selectedCategory, clear: () => setSelectedCategory("all") },
    selectedChain !== "all" && { key: "chain", value: selectedChain, clear: () => setSelectedChain("all") },
    selectedAudit !== "all" && { key: "audit", value: selectedAudit, clear: () => setSelectedAudit("all") },
    selectedPricing !== "all" && { key: "pricing", value: selectedPricing, clear: () => setSelectedPricing("all") },
  ].filter(Boolean) as { key: string; value: string; clear: () => void }[];

  const clearAllFilters = () => {
    setSelectedCategory("all");
    setSelectedChain("all");
    setSelectedAudit("all");
    setSelectedPricing("all");
    setSearchQuery("");
  };

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
            AI Agent <span className="text-gradient">Marketplace</span>
          </h1>
          <p className="text-text-muted">
            Compare {agents.length} curated agents across {categories.length} Solana-native workflows
          </p>
        </motion.div>

        {/* Search & Sort Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-lg bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              id="marketplace-search"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4 text-text-muted" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none px-4 py-3 pr-10 rounded-lg bg-surface border border-border text-sm text-text-primary cursor-pointer focus:outline-none focus:border-primary/50 transition-all"
              id="marketplace-sort"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
              showFilters
                ? "bg-primary/15 border-primary/30 text-primary-hover"
                : "bg-surface border-border text-text-secondary hover:text-text-primary"
            }`}
            id="filter-toggle"
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-5 rounded-lg bg-surface border border-border"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.agentCount})
                    </option>
                  ))}
                </select>
              </div>

              {/* Chain */}
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Network
                </label>
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Chains</option>
                  {chainOptions.map((chain) => (
                    <option key={chain} value={chain}>
                      {chain.charAt(0).toUpperCase() + chain.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audit */}
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Audit Status
                </label>
                <select
                  value={selectedAudit}
                  onChange={(e) => setSelectedAudit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Status</option>
                  {auditOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing */}
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 block">
                  Pricing
                </label>
                <select
                  value={selectedPricing}
                  onChange={(e) => setSelectedPricing(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-text-primary focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Pricing</option>
                  {pricingOptions.map((pricing) => (
                    <option key={pricing} value={pricing}>
                      {pricing.charAt(0).toUpperCase() + pricing.slice(1).replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs text-text-muted">Active filters:</span>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={filter.clear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-dim text-primary-hover text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                {filter.value}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs text-text-muted hover:text-danger transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-text-muted">
            Showing <span className="font-semibold text-text-primary">{filteredAgents.length}</span> agents
          </p>
        </div>

        {/* Agent Grid */}
        {filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAgents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-lg bg-surface border border-border flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No agents found</h3>
            <p className="text-sm text-text-muted mb-4">
              Try adjusting your search or filters to find what you&apos;re looking for.
            </p>
            <button
              onClick={clearAllFilters}
              className="btn-secondary text-sm"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
