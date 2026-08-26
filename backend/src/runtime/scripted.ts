import type { GrantState } from "../policy/types.js";

// Deterministic agent for the demo. Produces the six-beat story from the
// blueprint without depending on an LLM:
//   3 compliant transfers → 1 over-cap transfer (the moment) → stop.
// Amounts scale from the grant so the same script works for any cap.

export interface PlannedIntent {
  mint: string;
  amountUnits: bigint;
  destination: string;
  reason: string;
  submitEvenIfDenied: boolean;
}

export function scriptedPlan(grant: GrantState, step: number): PlannedIntent | null {
  const mint = grant.allowedMints[0];
  const dest = grant.allowedDestinations[0];
  const slice = grant.spendCapUnits / 5n; // 20% of cap each
  if (step < 3) {
    return { mint, amountUnits: slice, destination: dest, reason: `Rebalance tranche ${step + 1}/3 to treasury ops wallet`, submitEvenIfDenied: false };
  }
  if (step === 3) {
    // 60% of cap on top of 60% already spent → exceeds cap. Submitted anyway
    // so the program's rejection lands on the explorer.
    return { mint, amountUnits: slice * 3n, destination: dest, reason: "Opportunistic large transfer (exceeds remaining budget)", submitEvenIfDenied: true };
  }
  return null;
}
