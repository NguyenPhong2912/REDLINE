import { AccountRole, type Address, type Instruction } from "@solana/kit";

// Plain System Program SOL transfer — used to pay a marketplace listing's
// rental price. No REDLINE program involved: renting is an off-chain
// agreement (backend/src/routes/listings.ts) funded by an ordinary
// wallet-signed payment, verified against Devnet before the hire is recorded.
const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;
const TRANSFER_DISCRIMINANT = 2;

export function transferSolInstruction(source: string, destination: string, lamports: bigint): Instruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, TRANSFER_DISCRIMINANT, true);
  view.setBigUint64(4, lamports, true);
  return {
    programAddress: SYSTEM_PROGRAM,
    accounts: [
      { address: source as Address, role: AccountRole.WRITABLE_SIGNER },
      { address: destination as Address, role: AccountRole.WRITABLE },
    ],
    data,
  };
}
