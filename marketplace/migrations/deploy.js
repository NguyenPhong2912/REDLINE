/* eslint-disable @typescript-eslint/no-require-imports */

const anchor = require("@anchor-lang/core");
const { PublicKey, SystemProgram } = require("@solana/web3.js");

const idl = require("../src/idl/agentx_marketplace.json");

const MARKETPLACE_SEED = Buffer.from("marketplace");
const MAX_FEE_BASIS_POINTS = 1_000;

function readFeeBasisPoints() {
  const value = Number(process.env.AGENTX_FEE_BASIS_POINTS ?? "250");

  if (!Number.isInteger(value) || value < 0 || value > MAX_FEE_BASIS_POINTS) {
    throw new Error(
      `AGENTX_FEE_BASIS_POINTS must be an integer from 0 to ${MAX_FEE_BASIS_POINTS}`,
    );
  }

  return value;
}

module.exports = async function initializeMarketplace(provider) {
  const treasuryValue = process.env.AGENTX_TREASURY;
  if (!treasuryValue) {
    throw new Error("AGENTX_TREASURY must contain a funded system account address");
  }

  anchor.setProvider(provider);

  const program = new anchor.Program(idl, provider);
  const treasury = new PublicKey(treasuryValue);
  const feeBasisPoints = readFeeBasisPoints();
  const [marketplace] = PublicKey.findProgramAddressSync(
    [MARKETPLACE_SEED],
    program.programId,
  );

  const existingAccount = await provider.connection.getAccountInfo(
    marketplace,
    "confirmed",
  );

  if (existingAccount) {
    const config = await program.account.marketplaceConfig.fetch(marketplace);
    const existingTreasury = config.treasury.toBase58();
    const existingFeeBasisPoints = Number(config.feeBasisPoints);

    if (
      existingTreasury !== treasury.toBase58() ||
      existingFeeBasisPoints !== feeBasisPoints
    ) {
      throw new Error(
        `Marketplace ${marketplace.toBase58()} already exists with treasury ${existingTreasury} and fee ${existingFeeBasisPoints}`,
      );
    }

    console.log(`Marketplace already initialized: ${marketplace.toBase58()}`);
    return;
  }

  const signature = await program.methods
    .initializeMarketplace(feeBasisPoints)
    .accounts({
      marketplace,
      authority: provider.wallet.publicKey,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: "confirmed" });

  console.log(`Marketplace initialized: ${marketplace.toBase58()}`);
  console.log(`Transaction signature: ${signature}`);
};
