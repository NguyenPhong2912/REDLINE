// ============================================================
// Utility Functions
// ============================================================

import { clsx, type ClassValue } from "clsx";
import type { Currency } from "@/types";

const DISPLAY_LOCALE = "en-US";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString(DISPLAY_LOCALE);
}

export function formatToken(amount: number, currency: Currency = "SOL"): string {
  const maximumFractionDigits = currency === "USDC" ? 2 : 3;
  return `${amount.toLocaleString(DISPLAY_LOCALE, {
    minimumFractionDigits: amount < 1 ? 2 : 0,
    maximumFractionDigits,
  })} ${currency}`;
}

export function formatSOL(amount: number): string {
  return formatToken(amount, "SOL");
}

export function formatUSD(amount: number): string {
  return "$" + amount.toLocaleString(DISPLAY_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(dateString);
}

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getRatingStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    defi: "#14f195",
    trading: "#06b6d4",
    nft: "#ec4899",
    analytics: "#3b82f6",
    security: "#10b981",
    social: "#8b5cf6",
    governance: "#f59e0b",
    utility: "#a855f7",
  };
  return colors[category] || "#14f195";
}
