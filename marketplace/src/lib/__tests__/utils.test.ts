import { describe, expect, it } from "vitest";
import { formatNumber, formatToken, formatUSD } from "@/lib/utils";

describe("display formatting", () => {
  it("uses deterministic decimal separators for token amounts", () => {
    expect(formatToken(0.05, "SOL")).toBe("0.05 SOL");
    expect(formatToken(1_234.5, "USDC")).toBe("1,234.5 USDC");
  });

  it("formats compact counts and USD consistently", () => {
    expect(formatNumber(1_250)).toBe("1.3K");
    expect(formatUSD(1_234.5)).toBe("$1,234.50");
  });
});
