use anchor_lang::prelude::*;

declare_id!("GSWCWBuCj1ihniuZukJt85oCYo5jnaUUv558Eaa8dzbF");

#[program]
pub mod redline_guardrails {
    use super::*;

    pub fn create_policy(
        ctx: Context<CreatePolicy>,
        agent_id: [u8; 16],
        policy_hash: [u8; 32],
        spend_cap_units: u64,
        max_transactions: u32,
        expires_at: i64,
        cooldown_seconds: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(spend_cap_units > 0, RedlineError::InvalidSpendCap);
        require!(max_transactions > 0, RedlineError::InvalidTransactionCap);
        require!(expires_at > clock.unix_timestamp, RedlineError::InvalidExpiry);
        require!(cooldown_seconds >= 0, RedlineError::InvalidCooldown);

        let policy = &mut ctx.accounts.policy;
        policy.authority = ctx.accounts.authority.key();
        policy.executor = ctx.accounts.executor.key();
        policy.agent_id = agent_id;
        policy.policy_hash = policy_hash;
        policy.spend_cap_units = spend_cap_units;
        policy.spent_units = 0;
        policy.max_transactions = max_transactions;
        policy.transaction_count = 0;
        policy.created_at = clock.unix_timestamp;
        policy.expires_at = expires_at;
        policy.cooldown_seconds = cooldown_seconds;
        policy.last_execution_at = 0;
        policy.active = true;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyCreated {
            policy: policy.key(),
            authority: policy.authority,
            executor: policy.executor,
            policy_hash,
        });
        Ok(())
    }

    pub fn record_execution(ctx: Context<RecordExecution>, amount_units: u64) -> Result<()> {
        let clock = Clock::get()?;
        let policy = &mut ctx.accounts.policy;

        require!(policy.active, RedlineError::PolicyRevoked);
        require!(clock.unix_timestamp < policy.expires_at, RedlineError::PolicyExpired);
        require!(
            policy.transaction_count < policy.max_transactions,
            RedlineError::TransactionCapExceeded
        );
        require!(
            policy.spent_units.checked_add(amount_units).ok_or(RedlineError::ArithmeticOverflow)?
                <= policy.spend_cap_units,
            RedlineError::SpendCapExceeded
        );
        if policy.last_execution_at > 0 {
            require!(
                clock.unix_timestamp - policy.last_execution_at >= policy.cooldown_seconds,
                RedlineError::CooldownActive
            );
        }

        policy.spent_units = policy
            .spent_units
            .checked_add(amount_units)
            .ok_or(RedlineError::ArithmeticOverflow)?;
        policy.transaction_count = policy
            .transaction_count
            .checked_add(1)
            .ok_or(RedlineError::ArithmeticOverflow)?;
        policy.last_execution_at = clock.unix_timestamp;

        emit!(ExecutionRecorded {
            policy: policy.key(),
            executor: ctx.accounts.executor.key(),
            amount_units,
            transaction_count: policy.transaction_count,
        });
        Ok(())
    }

    pub fn revoke_policy(ctx: Context<ManagePolicy>) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        require!(policy.active, RedlineError::PolicyRevoked);
        policy.active = false;
        emit!(PolicyRevoked {
            policy: policy.key(),
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(agent_id: [u8; 16])]
pub struct CreatePolicy<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentPolicy::INIT_SPACE,
        seeds = [b"policy", authority.key().as_ref(), agent_id.as_ref()],
        bump
    )]
    pub policy: Account<'info, AgentPolicy>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The executor is stored as a public key and must sign every execution receipt.
    pub executor: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordExecution<'info> {
    #[account(mut, has_one = executor)]
    pub policy: Account<'info, AgentPolicy>,
    pub executor: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManagePolicy<'info> {
    #[account(mut, has_one = authority)]
    pub policy: Account<'info, AgentPolicy>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct AgentPolicy {
    pub authority: Pubkey,
    pub executor: Pubkey,
    pub agent_id: [u8; 16],
    pub policy_hash: [u8; 32],
    pub spend_cap_units: u64,
    pub spent_units: u64,
    pub max_transactions: u32,
    pub transaction_count: u32,
    pub created_at: i64,
    pub expires_at: i64,
    pub cooldown_seconds: i64,
    pub last_execution_at: i64,
    pub active: bool,
    pub bump: u8,
}

#[event]
pub struct PolicyCreated {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub executor: Pubkey,
    pub policy_hash: [u8; 32],
}

#[event]
pub struct ExecutionRecorded {
    pub policy: Pubkey,
    pub executor: Pubkey,
    pub amount_units: u64,
    pub transaction_count: u32,
}

#[event]
pub struct PolicyRevoked {
    pub policy: Pubkey,
    pub authority: Pubkey,
}

#[error_code]
pub enum RedlineError {
    #[msg("Spend cap must be greater than zero")]
    InvalidSpendCap,
    #[msg("Transaction cap must be greater than zero")]
    InvalidTransactionCap,
    #[msg("Expiry must be in the future")]
    InvalidExpiry,
    #[msg("Cooldown cannot be negative")]
    InvalidCooldown,
    #[msg("Policy has been revoked")]
    PolicyRevoked,
    #[msg("Policy has expired")]
    PolicyExpired,
    #[msg("Transaction cap exceeded")]
    TransactionCapExceeded,
    #[msg("Spend cap exceeded")]
    SpendCapExceeded,
    #[msg("Cooldown is still active")]
    CooldownActive,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
