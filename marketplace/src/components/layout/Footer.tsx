import Link from "next/link";
import { Bot, ExternalLink } from "lucide-react";

const productLinks = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Create agent", href: "/create" },
  { label: "Playground", href: "/playground" },
  { label: "Dashboard", href: "/dashboard" },
];

const developerLinks = [
  { label: "Solana docs", href: "https://solana.com/docs" },
  { label: "Anchor docs", href: "https://www.anchor-lang.com/docs" },
  { label: "OpenAI API docs", href: "https://developers.openai.com/api/docs" },
  { label: "Devnet Explorer", href: "https://explorer.solana.com/?cluster=devnet" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <div className="max-w-md">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                <Bot className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold">AgentX</span>
            </Link>
            <p className="text-sm leading-6 text-text-muted">
              A Solana marketplace prototype for publishing, purchasing, and running inspectable AI agents.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
              <span className="h-2 w-2 rounded-full bg-success" /> Devnet workspace
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Product</h2>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-muted transition-colors hover:text-text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Developers</h2>
            <ul className="space-y-2.5">
              {developerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
                  >
                    {link.label} <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border py-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>(c) 2026 AgentX.</p>
          <div className="flex items-center gap-4">
            <Link href="/settings" className="hover:text-text-primary">Settings</Link>
            <Link href="/api/health" className="hover:text-text-primary">API status</Link>
            <span>Solana Devnet</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
