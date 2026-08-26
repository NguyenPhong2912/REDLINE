//! REDLINE guardrails v2 — on-chain enforcement for autonomous agents.
//!
//! The owner deposits SPL tokens into a Vault PDA and signs a Grant that
//! bounds what an executor (the agent runtime's key) may do with them.
//! `execute_transfer` is the only path that moves funds out of the vault and
//! it passes seven gates before the CPI. A rejected intent moves nothing.
//!
//! Gate order (mirrored by backend/src/policy/engine.ts):
//!   1 Revoked  2 Expired  3 NonceReplay  4 MintNotAllowed
//!   5 DestinationNotAllowed  6 TxCapExceeded / SpendCapExceeded  7 CooldownActive

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("BYDBYcQcqSkNMmJTU47aYJxprL8k2RM9iTTogADBmpVW");

pub const MAX_ALLOWLIST: usize = 4;
pub const VAULT_SEED: &[u8] = b"vault";
pub const GRANT_SEED: &[u8] = b"grant";

#[program]
pub mod redline_guardrails {
    use super::*;

    /// One vault per owner. Token accounts are ATAs owned by this PDA, so
    /// only this program can sign transfers out of them.
    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.bump = ctx.bumps.vault;
        vault.created_at = Clock::get()?.unix_timestamp;
        emit!(VaultInitialized { vault: vault.key(), owner: vault.owner });
        Ok(())
    }

    /// Owner signs once. `agent_id` is a random 16-byte seed so one owner can
    /// hold many grants. `policy_hash` binds the human-readable policy the
    /// owner reviewed in the UI to this on-chain record.
    #[allow(clippy::too_many_arguments)]
    pub fn create_grant(
        ctx: Context<CreateGrant>,
        agent_id: [u8; 16],
        policy_hash: [u8; 32],
        spend_cap_units: u64,
        max_transactions: u32,
        expires_at: i64,
        cooldown_seconds: i64,
        allowed_mints: Vec<Pubkey>,
        allowed_destinations: Vec<Pubkey>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(spend_cap_units > 0, RedlineError::InvalidSpendCap);
        require!(max_transactions > 0, RedlineError::InvalidTransactionCap);
        require!(expires_at > clock.unix_timestamp, RedlineError::InvalidExpiry);
        require!(cooldown_seconds >= 0, RedlineError::InvalidCooldown);
        require!(
            !allowed_mints.is_empty() && allowed_mints.len() <= MAX_ALLOWLIST,
            RedlineError::InvalidAllowlist
        );
        require!(
            !allowed_destinations.is_empty() && allowed_destinations.len() <= MAX_ALLOWLIST,
            RedlineError::InvalidAllowlist
        );

        let grant = &mut ctx.accounts.grant;
        grant.owner = ctx.accounts.owner.key();
        grant.vault = ctx.accounts.vault.key();
        grant.executor = ctx.accounts.executor.key();
        grant.agent_id = agent_id;
        grant.policy_hash = policy_hash;
        grant.spend_cap_units = spend_cap_units;
        grant.spent_units = 0;
        grant.max_transactions = max_transactions;
        grant.transaction_count = 0;
        grant.next_nonce = 0;
        grant.created_at = clock.unix_timestamp;
        grant.expires_at = expires_at;
        grant.cooldown_seconds = cooldown_seconds;
        grant.last_execution_at = 0;
        grant.active = true;
        grant.bump = ctx.bumps.grant;
        grant.allowed_mints = allowed_mints;
        grant.allowed_destinations = allowed_destinations;

        emit!(GrantCreated {
            grant: grant.key(),
            owner: grant.owner,
            vault: grant.vault,
            executor: grant.executor,
            policy_hash,
            spend_cap_units,
            max_transactions,
            expires_at,
        });
        Ok(())
    }

    /// The only instruction that moves funds. The executor proposes; the
    /// gates decide; the CPI and the counter update happen atomically.
    pub fn execute_transfer(ctx: Context<ExecuteTransfer>, nonce: u64, amount_units: u64) -> Result<()> {
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let grant = &mut ctx.accounts.grant;
        let mint = ctx.accounts.mint.key();
        let destination = ctx.accounts.destination_token_account.owner;

        // Gate 1–7. First failure returns; nothing below runs.
        require!(grant.active, RedlineError::Revoked);
        require!(now < grant.expires_at, RedlineError::Expired);
        require!(nonce == grant.next_nonce, RedlineError::NonceReplay);
        require!(grant.allowed_mints.contains(&mint), RedlineError::MintNotAllowed);
        require!(
            grant.allowed_destinations.contains(&destination),
            RedlineError::DestinationNotAllowed
        );
        require!(
            grant.transaction_count < grant.max_transactions,
            RedlineError::TxCapExceeded
        );
        let new_spent = grant
            .spent_units
            .checked_add(amount_units)
            .ok_or(RedlineError::ArithmeticOverflow)?;
        require!(new_spent <= grant.spend_cap_units, RedlineError::SpendCapExceeded);
        if grant.last_execution_at > 0 {
            require!(
                now - grant.last_execution_at >= grant.cooldown_seconds,
                RedlineError::CooldownActive
            );
        }

        // Counters first, then CPI — both revert together if the CPI fails.
        grant.spent_units = new_spent;
        grant.transaction_count += 1;
        grant.next_nonce += 1;
        grant.last_execution_at = now;

        let vault = &ctx.accounts.vault;
        let owner_key = vault.owner;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, owner_key.as_ref(), &[vault.bump]]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount_units,
        )?;

        emit!(PolicyDecision {
            grant: grant.key(),
            executor: ctx.accounts.executor.key(),
            nonce,
            mint,
            destination,
            amount_units,
            spent_units: grant.spent_units,
            transaction_count: grant.transaction_count,
            slot: clock.slot,
        });
        Ok(())
    }

    pub fn revoke_grant(ctx: Context<ManageGrant>) -> Result<()> {
        let grant = &mut ctx.accounts.grant;
        require!(grant.active, RedlineError::Revoked);
        grant.active = false;
        emit!(GrantRevoked { grant: grant.key(), owner: ctx.accounts.owner.key() });
        Ok(())
    }

    /// Owner pulls tokens back out of the vault at any time. No gates: the
    /// owner's own key is the authority here, not a grant.
    pub fn withdraw(ctx: Context<Withdraw>, amount_units: u64) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let owner_key = vault.owner;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, owner_key.as_ref(), &[vault.bump]]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount_units,
        )?;
        emit!(Withdrawn { vault: vault.key(), owner: owner_key, mint: ctx.accounts.mint.key(), amount_units });
        Ok(())
    }
}

// ───────────────────────── accounts ─────────────────────────

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: [u8; 16])]
pub struct CreateGrant<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Grant::INIT_SPACE,
        seeds = [GRANT_SEED, owner.key().as_ref(), agent_id.as_ref()],
        bump
    )]
    pub grant: Account<'info, Grant>,
    #[account(seeds = [VAULT_SEED, owner.key().as_ref()], bump = vault.bump, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: stored as a pubkey; must sign every execute_transfer.
    pub executor: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteTransfer<'info> {
    #[account(mut, has_one = vault, has_one = executor)]
    pub grant: Account<'info, Grant>,
    #[account(seeds = [VAULT_SEED, vault.owner.as_ref()], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    pub executor: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint)]
    pub destination_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ManageGrant<'info> {
    #[account(mut, has_one = owner)]
    pub grant: Account<'info, Grant>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(seeds = [VAULT_SEED, owner.key().as_ref()], bump = vault.bump, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ───────────────────────── state ─────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub owner: Pubkey,
    pub bump: u8,
    pub created_at: i64,
}

/// Field order is the wire layout decoded by backend/src/chain/anchor.ts.
/// Append new fields at the end; never reorder.
#[account]
#[derive(InitSpace)]
pub struct Grant {
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub agent_id: [u8; 16],
    pub policy_hash: [u8; 32],
    pub spend_cap_units: u64,
    pub spent_units: u64,
    pub max_transactions: u32,
    pub transaction_count: u32,
    pub next_nonce: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub cooldown_seconds: i64,
    pub last_execution_at: i64,
    pub active: bool,
    pub bump: u8,
    #[max_len(MAX_ALLOWLIST)]
    pub allowed_mints: Vec<Pubkey>,
    #[max_len(MAX_ALLOWLIST)]
    pub allowed_destinations: Vec<Pubkey>,
}

// ───────────────────────── events ─────────────────────────

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct GrantCreated {
    pub grant: Pubkey,
    pub owner: Pubkey,
    pub vault: Pubkey,
    pub executor: Pubkey,
    pub policy_hash: [u8; 32],
    pub spend_cap_units: u64,
    pub max_transactions: u32,
    pub expires_at: i64,
}

/// Emitted only on ALLOW. A rejection surfaces as the transaction error
/// (custom code 6000 + variant index) — see RedlineError.
#[event]
pub struct PolicyDecision {
    pub grant: Pubkey,
    pub executor: Pubkey,
    pub nonce: u64,
    pub mint: Pubkey,
    pub destination: Pubkey,
    pub amount_units: u64,
    pub spent_units: u64,
    pub transaction_count: u32,
    pub slot: u64,
}

#[event]
pub struct GrantRevoked {
    pub grant: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount_units: u64,
}

// ───────────────────────── errors ─────────────────────────

/// Variant order is the error code (6000 + index). The backend maps these
/// numbers back to reason codes, so append only.
#[error_code]
pub enum RedlineError {
    #[msg("Spend cap must be greater than zero")]
    InvalidSpendCap, // 6000
    #[msg("Transaction cap must be greater than zero")]
    InvalidTransactionCap, // 6001
    #[msg("Expiry must be in the future")]
    InvalidExpiry, // 6002
    #[msg("Cooldown cannot be negative")]
    InvalidCooldown, // 6003
    #[msg("Allowlists must have 1 to 4 entries")]
    InvalidAllowlist, // 6004
    #[msg("Grant has been revoked")]
    Revoked, // 6005
    #[msg("Grant has expired")]
    Expired, // 6006
    #[msg("Nonce does not match the grant's next nonce")]
    NonceReplay, // 6007
    #[msg("Mint is not on the grant allowlist")]
    MintNotAllowed, // 6008
    #[msg("Destination is not on the grant allowlist")]
    DestinationNotAllowed, // 6009
    #[msg("Transaction cap exceeded")]
    TxCapExceeded, // 6010
    #[msg("Spend cap exceeded")]
    SpendCapExceeded, // 6011
    #[msg("Cooldown is still active")]
    CooldownActive, // 6012
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow, // 6013
}
