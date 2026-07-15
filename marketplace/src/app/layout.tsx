import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "AgentX | Solana AI Agent Marketplace",
  description:
    "Discover, test, and monetize verified AI agents with access and payments settled on Solana.",
  keywords: [
    "AI agents",
    "Solana",
    "DeFi",
    "marketplace",
    "on-chain AI",
    "Anchor",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
