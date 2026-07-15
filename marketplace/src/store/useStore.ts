"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AccessGrant,
  Agent,
  AgentRun,
  ChatMessage,
  Notification,
  Transaction,
} from "@/types";
import {
  agents as seedAgents,
  notifications as seedNotifications,
} from "@/lib/mock-data";

interface MarketplaceStore {
  profile: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    socialHandle: string;
  };
  updateProfile: (profile: Partial<MarketplaceStore["profile"]>) => void;
  preferences: {
    agentUpdates: boolean;
    transactions: boolean;
    governance: boolean;
    productNews: boolean;
  };
  updatePreference: (
    preference: keyof MarketplaceStore["preferences"],
    enabled: boolean,
  ) => void;
  governanceVotes: Record<string, "for" | "against">;
  castGovernanceVote: (proposalId: string, vote: "for" | "against") => void;
  createdAgents: Agent[];
  addAgent: (agent: Agent) => void;
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;

  accessGrants: AccessGrant[];
  grantAccess: (grant: AccessGrant) => void;
  hasAccess: (agentId: string, ownerAddress?: string) => boolean;
  consumeAccess: (agentId: string, ownerAddress: string) => void;
  runtimeTransactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
  agentRuns: AgentRun[];
  addAgentRun: (run: AgentRun) => void;
  likedAgentIds: string[];
  toggleLikedAgent: (agentId: string) => void;

  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Notification) => void;

  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useStore = create<MarketplaceStore>()(
  persist(
    (set, get) => ({
      profile: {
        displayName: "Neural Forge Labs",
        bio: "Building useful, inspectable AI agents for the Solana ecosystem.",
        location: "Remote",
        website: "",
        socialHandle: "@agentx_builder",
      },
      updateProfile: (profile) =>
        set((state) => ({ profile: { ...state.profile, ...profile } })),
      preferences: {
        agentUpdates: true,
        transactions: true,
        governance: true,
        productNews: false,
      },
      updatePreference: (preference, enabled) =>
        set((state) => ({
          preferences: { ...state.preferences, [preference]: enabled },
        })),
      governanceVotes: {},
      castGovernanceVote: (proposalId, vote) =>
        set((state) => ({
          governanceVotes: { ...state.governanceVotes, [proposalId]: vote },
        })),
      createdAgents: [],
      addAgent: (agent) =>
        set((state) => ({
          createdAgents: [
            agent,
            ...state.createdAgents.filter((item) => item.id !== agent.id),
          ],
        })),
      selectedAgent: null,
      setSelectedAgent: (agent) => set({ selectedAgent: agent }),
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      selectedCategory: "all",
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      sortBy: "trending",
      setSortBy: (sort) => set({ sortBy: sort }),

      accessGrants: [],
      grantAccess: (grant) =>
        set((state) => {
          const existing = state.accessGrants.find(
            (item) =>
              item.agentId === grant.agentId &&
              item.ownerAddress === grant.ownerAddress,
          );
          let merged: AccessGrant = {
            ...grant,
            transactionSignatures:
              grant.transactionSignatures ??
              (grant.transactionSignature
                ? [grant.transactionSignature]
                : undefined),
          };
          if (grant.pricingModel === "pay-per-use" && existing) {
            merged = {
              ...merged,
              remainingRuns:
                (existing.remainingRuns ?? 0) + (grant.remainingRuns ?? 1),
              transactionSignatures: [
                ...(existing.transactionSignatures ??
                  (existing.transactionSignature
                    ? [existing.transactionSignature]
                    : [])),
                ...(merged.transactionSignatures ?? []),
              ],
            };
          }
          if (grant.pricingModel === "subscription" && existing) {
            const extensionBase = Math.max(
              Date.now(),
              existing.expiresAt ? new Date(existing.expiresAt).getTime() : 0,
            );
            merged = {
              ...grant,
              expiresAt: new Date(
                extensionBase + 30 * 24 * 60 * 60 * 1_000,
              ).toISOString(),
            };
          }
          return {
            accessGrants: [
              merged,
              ...state.accessGrants.filter(
                (item) =>
                  !(
                    item.agentId === grant.agentId &&
                    item.ownerAddress === grant.ownerAddress
                  ),
              ),
            ],
          };
        }),
      hasAccess: (agentId, ownerAddress) => {
        const agent = [...get().createdAgents, ...seedAgents].find(
          (item) => item.id === agentId,
        );
        if (agent?.pricingModel === "free") return true;
        if (!ownerAddress) return false;
        if (agent?.creator.address === ownerAddress) return true;
        const grant = get().accessGrants.find(
          (item) =>
            item.agentId === agentId && item.ownerAddress === ownerAddress,
        );
        if (!grant) return false;
        if (agent?.pricingModel === "pay-per-use") {
          return (grant.remainingRuns ?? 0) > 0;
        }
        if (agent?.pricingModel === "subscription") {
          return Boolean(
            grant.expiresAt && new Date(grant.expiresAt).getTime() > Date.now(),
          );
        }
        return true;
      },
      consumeAccess: (agentId, ownerAddress) =>
        set((state) => ({
          accessGrants: state.accessGrants.map((grant) =>
            grant.agentId === agentId && grant.ownerAddress === ownerAddress
              ? {
                  ...grant,
                  remainingRuns: Math.max(0, (grant.remainingRuns ?? 0) - 1),
                  transactionSignatures: grant.transactionSignatures?.slice(1),
                }
              : grant,
          ),
        })),
      runtimeTransactions: [],
      addTransaction: (transaction) =>
        set((state) => ({
          runtimeTransactions: [transaction, ...state.runtimeTransactions],
        })),
      agentRuns: [],
      addAgentRun: (run) =>
        set((state) => ({ agentRuns: [run, ...state.agentRuns] })),
      likedAgentIds: [],
      toggleLikedAgent: (agentId) =>
        set((state) => ({
          likedAgentIds: state.likedAgentIds.includes(agentId)
            ? state.likedAgentIds.filter((id) => id !== agentId)
            : [...state.likedAgentIds, agentId],
        })),

      notifications: seedNotifications,
      unreadCount: seedNotifications.filter((item) => !item.read).length,
      markAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((notification) =>
            notification.id === id
              ? { ...notification, read: true }
              : notification,
          );
          return {
            notifications,
            unreadCount: notifications.filter((item) => !item.read).length,
          };
        }),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            read: true,
          })),
          unreadCount: 0,
        })),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        })),

      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      clearChat: () => set({ chatMessages: [] }),

      mobileMenuOpen: false,
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
    }),
    {
      name: "agentx-marketplace-v1",
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
        governanceVotes: state.governanceVotes,
        createdAgents: state.createdAgents,
        accessGrants: state.accessGrants,
        runtimeTransactions: state.runtimeTransactions,
        agentRuns: state.agentRuns,
        likedAgentIds: state.likedAgentIds,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    },
  ),
);

export function useMarketplaceAgents() {
  const createdAgents = useStore((state) => state.createdAgents);
  return useMemo(
    () => [...createdAgents, ...seedAgents],
    [createdAgents],
  );
}
