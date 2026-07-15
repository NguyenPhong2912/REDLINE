"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletConnection } from "@solana/react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import WalletButton from "@/components/wallet/WalletButton";
import { categories } from "@/lib/mock-data";
import { formatToken, getCategoryColor, truncateAddress } from "@/lib/utils";
import { useStore } from "@/store/useStore";
import type { Agent, AgentCategory, PricingModel } from "@/types";

type Step = {
  id: number;
  title: string;
  icon: LucideIcon;
};

type FormState = {
  name: string;
  description: string;
  category: AgentCategory | "";
  runtime: "server-default" | "demo";
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  capabilities: string[];
  pricingModel: PricingModel;
  price: string;
};

type CreateResponse = {
  agent?: Agent;
  error?: string;
};

const steps: Step[] = [
  { id: 1, title: "Identity", icon: Bot },
  { id: 2, title: "Runtime", icon: Cpu },
  { id: 3, title: "Pricing", icon: CircleDollarSign },
  { id: 4, title: "Review", icon: ShieldCheck },
];

const capabilitySuggestions: Record<AgentCategory, string[]> = {
  defi: ["Yield comparison", "Risk breakdown", "Protocol research"],
  nft: ["Trait research", "Comparable sales", "Holder analysis"],
  trading: ["Route comparison", "Slippage estimate", "Trade simulation"],
  analytics: ["Wallet exposure", "Performance report", "Risk scenarios"],
  security: ["Authority checks", "Holder concentration", "Liquidity review"],
  social: ["Theme detection", "Source diversity", "Sentiment context"],
  governance: ["Proposal summary", "Tradeoff analysis", "Parameter review"],
  utility: ["Research checklist", "Workflow planning", "Evidence tracking"],
};

const initialForm: FormState = {
  name: "",
  description: "",
  category: "",
  runtime: "server-default",
  temperature: 0.4,
  maxTokens: 900,
  systemPrompt: "",
  capabilities: [],
  pricingModel: "one-time",
  price: "0.05",
};

export default function CreateAgentPage() {
  const router = useRouter();
  const { wallet } = useWalletConnection();
  const walletAddress = wallet?.account.address.toString();
  const addAgent = useStore((state) => state.addAgent);
  const addNotification = useStore((state) => state.addNotification);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [capabilityDraft, setCapabilityDraft] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectCategory(category: AgentCategory) {
    setForm((current) => ({
      ...current,
      category,
      capabilities:
        current.capabilities.length > 0
          ? current.capabilities
          : capabilitySuggestions[category],
    }));
  }

  function addCapability(value = capabilityDraft) {
    const capability = value.trim();
    if (
      capability.length < 2 ||
      capability.length > 60 ||
      form.capabilities.length >= 12 ||
      form.capabilities.some(
        (item) => item.toLowerCase() === capability.toLowerCase(),
      )
    ) {
      return;
    }
    update("capabilities", [...form.capabilities, capability]);
    setCapabilityDraft("");
  }

  function removeCapability(capability: string) {
    update(
      "capabilities",
      form.capabilities.filter((item) => item !== capability),
    );
  }

  function validationMessage(step: number) {
    if (step === 1) {
      if (form.name.trim().length < 3) return "Agent name must have at least 3 characters.";
      if (form.description.trim().length < 24) return "Description must have at least 24 characters.";
      if (!form.category) return "Choose an agent category.";
    }
    if (step === 2) {
      if (form.capabilities.length === 0) return "Add at least one capability.";
      if (form.systemPrompt.length > 8_000) return "System guidance is too long.";
    }
    if (step === 3) {
      const price = Number(form.price);
      if (form.pricingModel !== "free" && (!Number.isFinite(price) || price <= 0)) {
        return "Enter a price greater than zero.";
      }
      if (price > 10_000) return "Price cannot exceed 10,000 SOL.";
    }
    if (step === 4 && !walletAddress) return "Connect a Solana wallet to create the draft.";
    return "";
  }

  function goNext() {
    const message = validationMessage(currentStep);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setCurrentStep((step) => Math.min(step + 1, steps.length));
  }

  async function submitAgent() {
    const message = validationMessage(4);
    if (message || !walletAddress || !form.category) {
      setError(message || "Complete the required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          pricingModel: form.pricingModel,
          price: form.pricingModel === "free" ? 0 : Number(form.price),
          currency: "SOL",
          llmModel: form.runtime,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          systemPrompt: form.systemPrompt.trim(),
          capabilities: form.capabilities,
          ownerAddress: walletAddress,
        }),
      });
      const body = (await response.json()) as CreateResponse;
      if (!response.ok || !body.agent) {
        throw new Error(body.error ?? "Unable to create the agent draft.");
      }

      addAgent(body.agent);
      addNotification({
        id: crypto.randomUUID(),
        type: "success",
        title: "Agent draft created",
        message: `${body.agent.name} is ready for testing on Devnet.`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      router.push(`/marketplace/${body.agent.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create the agent draft.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-accent">
            <Rocket className="h-3.5 w-3.5" /> Creator workspace
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Create an AI agent</h1>
          <p className="mt-2 text-sm text-text-muted">
            Configure a testable draft, then register it with the AgentX program.
          </p>
        </motion.header>

        <nav className="mb-6 overflow-x-auto" aria-label="Creation progress">
          <ol className="flex min-w-[560px] items-center">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const complete = step.id < currentStep;
              const active = step.id === currentStep;
              return (
                <li key={step.id} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => complete && setCurrentStep(step.id)}
                    className={`flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary-dim text-primary-hover"
                        : complete
                          ? "text-success"
                          : "cursor-default text-text-muted"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                        active
                          ? "border-primary bg-primary text-white"
                          : complete
                            ? "border-success/40 bg-success-dim"
                            : "border-border bg-surface"
                      }`}
                    >
                      {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </span>
                    {step.title}
                  </button>
                  {index < steps.length - 1 && (
                    <span className={`mx-2 h-px flex-1 ${complete ? "bg-success/40" : "bg-border"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="rounded-lg border border-border bg-surface">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="min-h-[530px] p-5 sm:p-8"
            >
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Agent identity</h2>
                    <p className="mt-1 text-sm text-text-muted">Name the product and define its job.</p>
                  </div>

                  <div>
                    <label htmlFor="agent-name" className="mb-2 block text-sm font-medium">Name</label>
                    <input
                      id="agent-name"
                      value={form.name}
                      onChange={(event) => update("name", event.target.value.slice(0, 64))}
                      placeholder="Solana Risk Monitor"
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-text-muted focus:border-primary/50"
                    />
                    <p className="mt-1 text-right text-xs text-text-muted">{form.name.length}/64</p>
                  </div>

                  <div>
                    <label htmlFor="agent-description" className="mb-2 block text-sm font-medium">Description</label>
                    <textarea
                      id="agent-description"
                      value={form.description}
                      onChange={(event) => update("description", event.target.value.slice(0, 600))}
                      rows={4}
                      placeholder="Describe the users, evidence, and decisions this agent supports."
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-text-muted focus:border-primary/50"
                    />
                    <p className="mt-1 text-right text-xs text-text-muted">{form.description.length}/600</p>
                  </div>

                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">Category</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => selectCategory(category.id)}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            form.category === category.id
                              ? "border-primary bg-primary-dim"
                              : "border-border bg-background hover:border-border-light"
                          }`}
                        >
                          <span
                            className="mb-2 block h-2 w-8 rounded-full"
                            style={{ backgroundColor: getCategoryColor(category.id) }}
                          />
                          <span className="block text-sm font-semibold">{category.name}</span>
                          <span className="mt-1 block text-xs leading-5 text-text-muted">{category.description}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">AI runtime</h2>
                    <p className="mt-1 text-sm text-text-muted">Set execution mode and response boundaries.</p>
                  </div>

                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">Execution mode</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          id: "server-default" as const,
                          title: "Server AI",
                          description: "Uses the model configured by OPENAI_MODEL when an API key is present.",
                          icon: Sparkles,
                        },
                        {
                          id: "demo" as const,
                          title: "Deterministic demo",
                          description: "Runs locally defined category guidance without external AI billing.",
                          icon: Cpu,
                        },
                      ].map((runtime) => {
                        const Icon = runtime.icon;
                        return (
                          <button
                            key={runtime.id}
                            type="button"
                            onClick={() => update("runtime", runtime.id)}
                            className={`rounded-lg border p-4 text-left transition-colors ${
                              form.runtime === runtime.id
                                ? "border-primary bg-primary-dim"
                                : "border-border bg-background hover:border-border-light"
                            }`}
                          >
                            <span className="mb-3 flex items-center gap-2 text-sm font-semibold">
                              <Icon className="h-4 w-4 text-accent" /> {runtime.title}
                            </span>
                            <span className="block text-xs leading-5 text-text-muted">{runtime.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <label htmlFor="temperature" className="font-medium">Temperature</label>
                        <span className="font-mono text-text-muted">{form.temperature.toFixed(1)}</span>
                      </div>
                      <input
                        id="temperature"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={form.temperature}
                        onChange={(event) => update("temperature", Number(event.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <label htmlFor="max-tokens" className="font-medium">Max output tokens</label>
                        <span className="font-mono text-text-muted">{form.maxTokens}</span>
                      </div>
                      <input
                        id="max-tokens"
                        type="range"
                        min="128"
                        max="2000"
                        step="64"
                        value={form.maxTokens}
                        onChange={(event) => update("maxTokens", Number(event.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="system-prompt" className="mb-2 block text-sm font-medium">Creator guidance</label>
                    <textarea
                      id="system-prompt"
                      value={form.systemPrompt}
                      onChange={(event) => update("systemPrompt", event.target.value.slice(0, 8_000))}
                      rows={4}
                      placeholder="Define tone, analysis steps, and output format. Platform safety rules always take priority."
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-text-muted focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label htmlFor="capability" className="mb-2 block text-sm font-medium">Capabilities</label>
                    <div className="flex gap-2">
                      <input
                        id="capability"
                        value={capabilityDraft}
                        onChange={(event) => setCapabilityDraft(event.target.value.slice(0, 60))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCapability();
                          }
                        }}
                        placeholder="Add a capability"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-text-muted focus:border-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => addCapability()}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary/40 hover:text-primary-hover"
                        title="Add capability"
                        aria-label="Add capability"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {form.capabilities.map((capability) => (
                        <span key={capability} className="flex items-center gap-2 rounded-md bg-accent-dim px-2.5 py-1.5 text-xs text-accent">
                          {capability}
                          <button
                            type="button"
                            onClick={() => removeCapability(capability)}
                            className="rounded p-0.5 hover:bg-black/20"
                            title={`Remove ${capability}`}
                            aria-label={`Remove ${capability}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Access pricing</h2>
                    <p className="mt-1 text-sm text-text-muted">Set the Devnet access policy in SOL.</p>
                  </div>

                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">Pricing model</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { id: "free" as const, label: "Free", note: "Open access" },
                        { id: "one-time" as const, label: "One-time", note: "Permanent grant" },
                        { id: "pay-per-use" as const, label: "Per run", note: "One run credit" },
                        { id: "subscription" as const, label: "30 days", note: "Timed access" },
                      ].map((pricing) => (
                        <button
                          key={pricing.id}
                          type="button"
                          onClick={() => update("pricingModel", pricing.id)}
                          className={`rounded-lg border p-4 text-left transition-colors ${
                            form.pricingModel === pricing.id
                              ? "border-primary bg-primary-dim"
                              : "border-border bg-background hover:border-border-light"
                          }`}
                        >
                          <span className="block text-sm font-semibold">{pricing.label}</span>
                          <span className="mt-1 block text-xs text-text-muted">{pricing.note}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {form.pricingModel !== "free" && (
                    <div className="max-w-sm">
                      <label htmlFor="price" className="mb-2 block text-sm font-medium">Price</label>
                      <div className="relative">
                        <input
                          id="price"
                          type="number"
                          min="0.000001"
                          max="10000"
                          step="0.001"
                          value={form.price}
                          onChange={(event) => update("price", event.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-4 py-3 pr-16 text-sm outline-none transition-colors focus:border-primary/50"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-success">SOL</span>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Network", "Solana Devnet"],
                      ["Settlement", "Native SOL"],
                      ["Registry", "AgentX program"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-border bg-background p-4">
                        <p className="text-xs uppercase text-text-muted">{label}</p>
                        <p className="mt-2 text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Review draft</h2>
                    <p className="mt-1 text-sm text-text-muted">Confirm the metadata before creating the local Devnet draft.</p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-4 rounded-lg border border-border bg-background p-5">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white"
                          style={{ backgroundColor: form.category ? getCategoryColor(form.category) : "#64748b" }}
                        >
                          {form.name.charAt(0).toUpperCase() || "A"}
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold">{form.name}</h3>
                          <p className="text-xs capitalize text-text-muted">{form.category} agent</p>
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-text-secondary">{form.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {form.capabilities.map((capability) => (
                          <span key={capability} className="rounded-md bg-surface-hover px-2.5 py-1 text-xs text-text-secondary">{capability}</span>
                        ))}
                      </div>
                    </div>

                    <dl className="divide-y divide-border rounded-lg border border-border bg-background px-4">
                      {[
                        ["Runtime", form.runtime === "demo" ? "Demo" : "Server AI"],
                        ["Output limit", `${form.maxTokens} tokens`],
                        ["Access", form.pricingModel.replaceAll("-", " ")],
                        ["Price", form.pricingModel === "free" ? "Free" : formatToken(Number(form.price), "SOL")],
                        ["Cluster", "Devnet"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3 py-3 text-sm">
                          <dt className="text-text-muted">{label}</dt>
                          <dd className="text-right font-medium capitalize">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${walletAddress ? "bg-success-dim text-success" : "bg-warning-dim text-warning"}`}>
                        <Wallet className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">Creator wallet</p>
                        <p className="font-mono text-xs text-text-muted">
                          {walletAddress ? truncateAddress(walletAddress) : "Connection required"}
                        </p>
                      </div>
                    </div>
                    {!walletAddress && <WalletButton />}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="border-t border-border px-5 py-4 sm:px-8">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-dim p-3 text-sm text-danger" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setCurrentStep((step) => Math.max(1, step - 1));
                }}
                disabled={currentStep === 1 || isSubmitting}
                className="btn-secondary flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              {currentStep < steps.length ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm"
                >
                  <span>Continue</span> <ChevronRight className="relative z-10 h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submitAgent()}
                  disabled={isSubmitting || !walletAddress}
                  className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  id="create-agent-button"
                >
                  {isSubmitting ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <span>Create draft</span> <Rocket className="relative z-10 h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
