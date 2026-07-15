export type AgentCategory =
  | "defi"
  | "nft"
  | "trading"
  | "analytics"
  | "security"
  | "social"
  | "governance"
  | "utility";

export type AgentStatus = "active" | "paused" | "draft" | "deprecated";
export type AuditStatus = "verified" | "pending" | "unaudited";
export type PricingModel = "one-time" | "subscription" | "pay-per-use" | "free";
export type Chain = "solana";
export type SolanaCluster = "devnet" | "mainnet-beta";
export type Currency = "SOL" | "USDC";

export interface PerformanceData {
  date: string;
  roi: number;
  transactions: number;
  successRate: number;
  volume: number;
}

export interface Creator {
  id: string;
  name: string;
  avatar: string;
  address: string;
  verified: boolean;
  agentCount: number;
  totalEarnings: number;
  rating: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: AgentCategory;
  creator: Creator;
  price: number;
  currency: Currency;
  pricingModel: PricingModel;
  chain: Chain;
  cluster: SolanaCluster;
  status: AgentStatus;
  auditStatus: AuditStatus;
  verifiedOnChain: boolean;
  rating: number;
  reviewCount: number;
  totalUsers: number;
  totalTransactions: number;
  roi: number;
  successRate: number;
  responseTime: number;
  image: string;
  tags: string[];
  capabilities: string[];
  programId: string;
  listingAddress: string;
  metadataUri: string;
  runtimeMode?: "server" | "demo";
  systemPrompt?: string;
  maxOutputTokens?: number;
  demoPrompts: string[];
  createdAt: string;
  updatedAt: string;
  performance: PerformanceData[];
}

export interface Review {
  id: string;
  agentId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: "purchase" | "run" | "payout" | "refund" | "register";
  agentId: string;
  agentName: string;
  amount: number;
  token: Currency;
  from: string;
  to: string;
  signature: string;
  status: "confirmed" | "pending" | "failed";
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  proposerAvatar: string;
  status: "active" | "passed" | "rejected" | "pending";
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorum: number;
  startDate: string;
  endDate: string;
  category: "protocol" | "treasury" | "parameter" | "listing";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentId?: string;
  mode?: "live" | "demo";
}

export interface AgentRun {
  id: string;
  agentId: string;
  prompt: string;
  responsePreview: string;
  mode: "live" | "demo";
  createdAt: string;
}

export interface AccessGrant {
  agentId: string;
  ownerAddress: string;
  pricingModel?: PricingModel;
  transactionSignature?: string;
  transactionSignatures?: string[];
  grantedAt: string;
  expiresAt?: string;
  remainingRuns?: number;
}

export interface PortfolioItem {
  agentId: string;
  agentName: string;
  agentImage: string;
  category: AgentCategory;
  purchasePrice: number;
  currentValue: number;
  roi: number;
  purchaseDate: string;
}

export interface MarketStats {
  totalAgents: number;
  totalVolume: number;
  activeUsers: number;
  totalTransactions: number;
  avgRoi: number;
}

export interface CategoryInfo {
  id: AgentCategory;
  name: string;
  icon: string;
  description: string;
  agentCount: number;
  color: string;
}

export interface CreateAgentInput {
  name: string;
  description: string;
  category: AgentCategory;
  pricingModel: PricingModel;
  price: number;
  currency: Currency;
  llmModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  capabilities: string[];
  ownerAddress: string;
}
