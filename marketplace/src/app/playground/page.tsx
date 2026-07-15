"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWalletConnection } from "@solana/react-hooks";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  Copy,
  FlaskConical,
  LockKeyhole,
  Send,
  Sparkles,
  Trash2,
  User,
  Wifi,
} from "lucide-react";
import { useMarketplaceAgents, useStore } from "@/store/useStore";
import { formatToken, getCategoryColor, truncateAddress } from "@/lib/utils";
import type { ChatMessage } from "@/types";

type ChatResponse = {
  message?: string;
  mode?: "live" | "demo";
  model?: string;
  error?: string;
};

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <PlaygroundContent />
    </Suspense>
  );
}

function PlaygroundContent() {
  const allAgents = useMarketplaceAgents();
  const searchParams = useSearchParams();
  const { wallet } = useWalletConnection();
  const walletAddress = wallet?.account.address.toString();
  const hasAccess = useStore((state) => state.hasAccess);
  const accessGrants = useStore((state) => state.accessGrants);
  const addAgentRun = useStore((state) => state.addAgentRun);
  const consumeAccess = useStore((state) => state.consumeAccess);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState(
    () => searchParams.get("agent") ?? allAgents[0]?.id ?? "",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState<string>();
  const [copiedMessageId, setCopiedMessageId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedAgent =
    allAgents.find((agent) => agent.id === selectedAgentId) ?? allAgents[0];
  const ownsAgent = Boolean(
    selectedAgent && walletAddress === selectedAgent.creator.address,
  );
  const accessGrant = accessGrants.find(
    (grant) =>
      grant.agentId === selectedAgent?.id &&
      grant.ownerAddress === walletAddress,
  );
  const entitled = Boolean(
    selectedAgent &&
      (selectedAgent.pricingModel === "free" ||
        ownsAgent ||
        hasAccess(selectedAgent.id, walletAddress)),
  );
  const latestMode = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.mode;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

  function selectAgent(agentId: string) {
    setSelectedAgentId(agentId);
    setMessages([]);
    setError("");
    setModel(undefined);
    setShowAgentSelect(false);
    window.history.replaceState(null, "", `/playground?agent=${agentId}`);
  }

  async function ensureWalletSession() {
    if (!walletAddress || !wallet?.signMessage) {
      throw new Error(
        "Connect a wallet with message-signing support to use paid access.",
      );
    }

    const sessionResponse = await fetch("/api/auth/session");
    const session = (await sessionResponse.json()) as {
      authenticated?: boolean;
      address?: string | null;
    };
    if (session.authenticated && session.address === walletAddress) return;

    const challengeResponse = await fetch("/api/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: walletAddress }),
    });
    const challenge = (await challengeResponse.json()) as {
      nonce?: string;
      message?: string;
      error?: string;
    };
    if (!challengeResponse.ok || !challenge.nonce || !challenge.message) {
      throw new Error(challenge.error ?? "Unable to create a wallet challenge.");
    }

    const signature = await wallet.signMessage(
      new TextEncoder().encode(challenge.message),
    );
    let binarySignature = "";
    for (const byte of signature) {
      binarySignature += String.fromCharCode(byte);
    }

    const verifyResponse = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: walletAddress,
        nonce: challenge.nonce,
        signature: btoa(binarySignature),
      }),
    });
    const verification = (await verifyResponse.json()) as { error?: string };
    if (!verifyResponse.ok) {
      throw new Error(
        verification.error ?? "The wallet signature could not be verified.",
      );
    }
  }

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt || isRunning || !selectedAgent) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
      agentId: selectedAgent.id,
    };
    const requestMessages = [...messages, userMessage];
    setMessages(requestMessages);
    setInput("");
    setError("");
    setIsRunning(true);

    try {
      if (entitled && selectedAgent.pricingModel !== "free") {
        await ensureWalletSession();
      }
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          walletAddress,
          accessMode: entitled ? "granted" : "preview",
          accessProof:
            accessGrant?.transactionSignatures?.[0] ??
            accessGrant?.transactionSignature,
          agentContext: {
            name: selectedAgent.name,
            description: selectedAgent.longDescription,
            category: selectedAgent.category,
            capabilities: selectedAgent.capabilities,
            runtimeMode: selectedAgent.runtimeMode ?? "server",
            systemPrompt: selectedAgent.systemPrompt,
            maxOutputTokens: selectedAgent.maxOutputTokens,
            creatorAddress: selectedAgent.creator.address,
            pricingModel: selectedAgent.pricingModel,
            price: selectedAgent.price,
            currency: selectedAgent.currency,
          },
          messages: requestMessages.slice(-20).map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      const body = (await response.json()) as ChatResponse;
      if (!response.ok || !body.message || !body.mode) {
        throw new Error(body.error ?? "The agent could not complete this run.");
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: body.message,
        timestamp: new Date().toISOString(),
        agentId: selectedAgent.id,
        mode: body.mode,
      };
      setMessages((current) => [...current, assistantMessage]);
      setModel(body.model);
      addAgentRun({
        id: crypto.randomUUID(),
        agentId: selectedAgent.id,
        prompt,
        responsePreview: body.message.slice(0, 180),
        mode: body.mode,
        createdAt: new Date().toISOString(),
      });
      if (
        entitled &&
        !ownsAgent &&
        walletAddress &&
        selectedAgent.pricingModel === "pay-per-use" &&
        (body.mode === "live" || selectedAgent.runtimeMode === "demo")
      ) {
        consumeAccess(selectedAgent.id, walletAddress);
      }
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "The agent could not complete this run.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function copyMessage(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(undefined), 1_500);
  }

  if (!selectedAgent) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 text-text-muted">
        No agents are available.
      </div>
    );
  }

  const categoryColor = getCategoryColor(selectedAgent.category);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-accent">
              <FlaskConical className="h-3.5 w-3.5" /> Runtime
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">Agent Playground</h1>
          </div>
          <div className="flex items-center gap-2">
            {latestMode && (
              <span
                className={`badge ${latestMode === "live" ? "badge-success" : "badge-warning"}`}
              >
                {latestMode === "live" ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <FlaskConical className="h-3 w-3" />
                )}
                {latestMode === "live" ? model ?? "Live" : "Demo"}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError("");
                setModel(undefined);
              }}
              disabled={messages.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </motion.header>

        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAgentSelect((value) => !value)}
              className="flex h-14 w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 text-left transition-colors hover:border-primary/40"
              id="agent-selector"
              aria-expanded={showAgentSelect}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: categoryColor }}
              >
                {selectedAgent.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {selectedAgent.name}
                </span>
                <span className="block truncate text-xs capitalize text-text-muted">
                  {selectedAgent.category} · {formatToken(selectedAgent.price, selectedAgent.currency)}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-text-muted transition-transform ${showAgentSelect ? "rotate-180" : ""}`}
              />
            </button>

            {showAgentSelect && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-2xl shadow-black/40">
                {allAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => selectAgent(agent.id)}
                    className={`flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-surface-hover ${selectedAgent.id === agent.id ? "bg-primary-dim" : ""}`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: getCategoryColor(agent.category) }}
                    >
                      {agent.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{agent.name}</span>
                      <span className="block text-xs capitalize text-text-muted">{agent.category}</span>
                    </span>
                    <span className="text-xs text-text-muted">
                      {formatToken(agent.price, agent.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex h-14 items-center gap-3 rounded-lg border border-border bg-surface px-4 text-xs">
            <span className={`h-2 w-2 rounded-full ${walletAddress ? "bg-success" : "bg-warning"}`} />
            <span className="text-text-muted">Wallet</span>
            <span className="font-mono text-text-secondary">
              {walletAddress ? truncateAddress(walletAddress) : "Not connected"}
            </span>
          </div>
        </div>

        {!entitled && selectedAgent.pricingModel !== "free" && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning-dim px-4 py-3 text-sm">
            <LockKeyhole className="h-4 w-4 shrink-0 text-warning" />
            <p className="min-w-0 flex-1 text-text-secondary">
              Preview access only. Purchase this agent to enable live model runs.
            </p>
            <Link
              href={`/marketplace/${selectedAgent.id}`}
              className="font-semibold text-warning hover:text-text-primary"
            >
              View access
            </Link>
          </div>
        )}

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[430px] flex-col items-center justify-center text-center">
                <span
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: categoryColor }}
                >
                  <Bot className="h-7 w-7" />
                </span>
                <h2 className="text-lg font-semibold">{selectedAgent.name}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
                  {selectedAgent.description}
                </p>
                <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
                  {selectedAgent.demoPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setInput(prompt);
                        inputRef.current?.focus();
                      }}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
                  >
                    {message.role === "assistant" && (
                      <span
                        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: categoryColor }}
                      >
                        {selectedAgent.name.charAt(0)}
                      </span>
                    )}
                    <div className={`group max-w-[88%] sm:max-w-[78%] ${message.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`rounded-lg px-4 py-3 text-left text-sm leading-6 whitespace-pre-wrap ${
                          message.role === "user"
                            ? "bg-primary text-white"
                            : "border border-border bg-background text-text-secondary"
                        }`}
                      >
                        {message.content}
                      </div>
                      {message.role === "assistant" && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-[11px] uppercase text-text-muted">
                            {message.mode ?? "demo"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void copyMessage(message)}
                            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
                            title="Copy response"
                            aria-label="Copy response"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
                        <User className="h-4 w-4 text-text-muted" />
                      </span>
                    )}
                  </motion.div>
                ))}
                {isRunning && (
                  <div className="flex gap-3" aria-live="polite">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: categoryColor }}
                    >
                      {selectedAgent.name.charAt(0)}
                    </span>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-4 py-3">
                      {[0, 1, 2].map((delay) => (
                        <span
                          key={delay}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted"
                          style={{ animationDelay: `${delay * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border bg-background/40 p-4">
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-dim p-3 text-sm text-danger" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex items-end gap-3">
              <label htmlFor="playground-input" className="sr-only">Message</label>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 4_000))}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${selectedAgent.name}...`}
                rows={2}
                className="min-h-12 flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-primary/50"
                id="playground-input"
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isRunning}
                className="btn-primary flex h-12 w-12 items-center justify-center rounded-lg p-0 disabled:cursor-not-allowed disabled:opacity-50"
                id="send-message-btn"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="relative z-10 h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-text-muted">
              <span>{input.length}/4000</span>
              <span>{entitled ? "Access granted" : "Preview mode"}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
