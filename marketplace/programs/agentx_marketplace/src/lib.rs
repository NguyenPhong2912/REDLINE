use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("H6VwUUKHsBs6WdoJbye69E3124Fuo877azj9D9HqvniD");

const MARKETPLACE_SEED: &[u8] = b"marketplace";
const AGENT_SEED: &[u8] = b"agent";
const ACCESS_SEED: &[u8] = b"access";
const BASIS_POINTS_DENOMINATOR: u64 = 10_000;
const MAX_FEE_BASIS_POINTS: u16 = 1_000;
const SUBSCRIPTION_SECONDS: i64 = 30 * 24 * 60 * 60;

#[program]
pub mod agentx_marketplace {
    use super::*;

    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        fee_basis_points: u16,
    ) -> Result<()> {
        require!(
            fee_basis_points <= MAX_FEE_BASIS_POINTS,
            MarketplaceError::FeeTooHigh
        );

        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.authority = ctx.accounts.authority.key();
        marketplace.treasury = ctx.accounts.treasury.key();
        marketplace.fee_basis_points = fee_basis_points;
        marketplace.bump = ctx.bumps.marketplace;

        emit!(MarketplaceInitialized {
            authority: marketplace.authority,
            treasury: marketplace.treasury,
            fee_basis_points,
        });
        Ok(())
    }

    pub fn update_marketplace(
        ctx: Context<UpdateMarketplace>,
        new_authority: Option<Pubkey>,
        new_treasury: Option<Pubkey>,
        new_fee_basis_points: Option<u16>,
    ) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;

        if let Some(fee_basis_points) = new_fee_basis_points {
            require!(
                fee_basis_points <= MAX_FEE_BASIS_POINTS,
                MarketplaceError::FeeTooHigh
            );
            marketplace.fee_basis_points = fee_basis_points;
        }
        if let Some(treasury) = new_treasury {
            require_keys_neq!(treasury, Pubkey::default(), MarketplaceError::InvalidAddress);
            marketplace.treasury = treasury;
        }
        if let Some(authority) = new_authority {
            require_keys_neq!(authority, Pubkey::default(), MarketplaceError::InvalidAddress);
            marketplace.authority = authority;
        }

        emit!(MarketplaceUpdated {
            authority: marketplace.authority,
            treasury: marketplace.treasury,
            fee_basis_points: marketplace.fee_basis_points,
        });
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        agent_id: [u8; 32],
        metadata_hash: [u8; 32],
        price_lamports: u64,
        pricing_model: PricingModel,
    ) -> Result<()> {
        validate_listing(metadata_hash, price_lamports, pricing_model)?;
        let now = Clock::get()?.unix_timestamp;
        let listing = &mut ctx.accounts.listing;

        listing.creator = ctx.accounts.creator.key();
        listing.agent_id = agent_id;
        listing.metadata_hash = metadata_hash;
        listing.price_lamports = price_lamports;
        listing.pricing_model = pricing_model;
        listing.active = true;
        listing.total_purchases = 0;
        listing.created_at = now;
        listing.updated_at = now;
        listing.bump = ctx.bumps.listing;

        emit!(AgentRegistered {
            listing: listing.key(),
            creator: listing.creator,
            agent_id,
            metadata_hash,
            price_lamports,
            pricing_model,
        });
        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        metadata_hash: [u8; 32],
        price_lamports: u64,
        pricing_model: PricingModel,
        active: bool,
    ) -> Result<()> {
        validate_listing(metadata_hash, price_lamports, pricing_model)?;
        let listing = &mut ctx.accounts.listing;
        listing.metadata_hash = metadata_hash;
        listing.price_lamports = price_lamports;
        listing.pricing_model = pricing_model;
        listing.active = active;
        listing.updated_at = Clock::get()?.unix_timestamp;

        emit!(AgentUpdated {
            listing: listing.key(),
            metadata_hash,
            price_lamports,
            pricing_model,
            active,
        });
        Ok(())
    }

    pub fn purchase_access(ctx: Context<PurchaseAccess>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingPaused);
        require_keys_neq!(
            ctx.accounts.creator.key(),
            ctx.accounts.treasury.key(),
            MarketplaceError::CreatorCannotBeTreasury
        );

        let price_lamports = listing.price_lamports;
        let pricing_model = listing.pricing_model;
        let fee_lamports = calculate_fee(
            price_lamports,
            ctx.accounts.marketplace.fee_basis_points,
        )?;
        let creator_lamports = price_lamports
            .checked_sub(fee_lamports)
            .ok_or(MarketplaceError::ArithmeticOverflow)?;

        if creator_lamports > 0 {
            transfer(
                CpiContext::new(
                    System::id(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    },
                ),
                creator_lamports,
            )?;
        }
        if fee_lamports > 0 {
            transfer(
                CpiContext::new(
                    System::id(),
                    Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee_lamports,
            )?;
        }

        let now = Clock::get()?.unix_timestamp;
        let listing_key = ctx.accounts.listing.key();
        let buyer_key = ctx.accounts.buyer.key();
        let access = &mut ctx.accounts.access;
        let is_new = access.owner == Pubkey::default();

        if !is_new {
            require_keys_eq!(access.owner, buyer_key, MarketplaceError::InvalidAccessOwner);
            require_keys_eq!(access.listing, listing_key, MarketplaceError::InvalidListing);
        }

        match pricing_model {
            PricingModel::Free => access.permanent = true,
            PricingModel::OneTime => {
                require!(!access.permanent, MarketplaceError::AccessAlreadyPermanent);
                access.permanent = true;
            }
            PricingModel::Subscription => {
                let extension_base = access.expires_at.unwrap_or(now).max(now);
                access.expires_at = Some(
                    extension_base
                        .checked_add(SUBSCRIPTION_SECONDS)
                        .ok_or(MarketplaceError::ArithmeticOverflow)?,
                );
            }
            PricingModel::PayPerUse => {
                access.remaining_runs = access
                    .remaining_runs
                    .checked_add(1)
                    .ok_or(MarketplaceError::ArithmeticOverflow)?;
            }
        }

        access.owner = buyer_key;
        access.listing = listing_key;
        access.last_purchase_at = now;
        access.bump = ctx.bumps.access;

        let mutable_listing = &mut ctx.accounts.listing;
        mutable_listing.total_purchases = mutable_listing
            .total_purchases
            .checked_add(1)
            .ok_or(MarketplaceError::ArithmeticOverflow)?;
        mutable_listing.updated_at = now;

        emit!(AccessPurchased {
            listing: listing_key,
            buyer: buyer_key,
            pricing_model,
            price_lamports,
            fee_lamports,
            expires_at: access.expires_at,
            remaining_runs: access.remaining_runs,
        });
        Ok(())
    }

    pub fn consume_access(ctx: Context<ConsumeAccess>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(listing.active, MarketplaceError::ListingPaused);

        let access = &mut ctx.accounts.access;
        let executor = ctx.accounts.executor.key();
        require!(
            executor == access.owner || executor == ctx.accounts.marketplace.authority,
            MarketplaceError::UnauthorizedExecutor
        );

        let now = Clock::get()?.unix_timestamp;
        match listing.pricing_model {
            PricingModel::Free | PricingModel::OneTime => {
                require!(access.permanent, MarketplaceError::AccessDenied);
            }
            PricingModel::Subscription => {
                require!(
                    access.expires_at.is_some_and(|expires_at| expires_at > now),
                    MarketplaceError::SubscriptionExpired
                );
            }
            PricingModel::PayPerUse => {
                require!(access.remaining_runs > 0, MarketplaceError::NoRunCredits);
                access.remaining_runs = access
                    .remaining_runs
                    .checked_sub(1)
                    .ok_or(MarketplaceError::ArithmeticOverflow)?;
            }
        }

        access.usage_count = access
            .usage_count
            .checked_add(1)
            .ok_or(MarketplaceError::ArithmeticOverflow)?;
        access.last_used_at = now;

        emit!(AccessConsumed {
            listing: listing.key(),
            owner: access.owner,
            executor,
            usage_count: access.usage_count,
            remaining_runs: access.remaining_runs,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketplaceConfig::LEN,
        seeds = [MARKETPLACE_SEED],
        bump,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMarketplace<'info> {
    #[account(
        mut,
        seeds = [MARKETPLACE_SEED],
        bump = marketplace.bump,
        has_one = authority @ MarketplaceError::UnauthorizedAuthority,
    )]
    pub marketplace: Account<'info, MarketplaceConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(agent_id: [u8; 32])]
pub struct RegisterAgent<'info> {
    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, MarketplaceConfig>,
    #[account(
        init,
        payer = creator,
        space = 8 + AgentListing::LEN,
        seeds = [AGENT_SEED, creator.key().as_ref(), agent_id.as_ref()],
        bump,
    )]
    pub listing: Account<'info, AgentListing>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        seeds = [AGENT_SEED, listing.creator.as_ref(), listing.agent_id.as_ref()],
        bump = listing.bump,
        has_one = creator @ MarketplaceError::UnauthorizedCreator,
    )]
    pub listing: Account<'info, AgentListing>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct PurchaseAccess<'info> {
    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, MarketplaceConfig>,
    #[account(
        mut,
        seeds = [AGENT_SEED, listing.creator.as_ref(), listing.agent_id.as_ref()],
        bump = listing.bump,
        has_one = creator @ MarketplaceError::UnauthorizedCreator,
    )]
    pub listing: Account<'info, AgentListing>,
    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + AccessGrant::LEN,
        seeds = [ACCESS_SEED, listing.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub access: Account<'info, AccessGrant>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub creator: SystemAccount<'info>,
    #[account(
        mut,
        address = marketplace.treasury @ MarketplaceError::InvalidTreasury,
    )]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ConsumeAccess<'info> {
    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Account<'info, MarketplaceConfig>,
    #[account(
        seeds = [AGENT_SEED, listing.creator.as_ref(), listing.agent_id.as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, AgentListing>,
    #[account(
        mut,
        seeds = [ACCESS_SEED, listing.key().as_ref(), access.owner.as_ref()],
        bump = access.bump,
        constraint = access.listing == listing.key() @ MarketplaceError::InvalidListing,
    )]
    pub access: Account<'info, AccessGrant>,
    pub executor: Signer<'info>,
}

#[account]
pub struct MarketplaceConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_basis_points: u16,
    pub bump: u8,
}

impl MarketplaceConfig {
    pub const LEN: usize = 32 + 32 + 2 + 1;
}

#[account]
pub struct AgentListing {
    pub creator: Pubkey,
    pub agent_id: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub price_lamports: u64,
    pub pricing_model: PricingModel,
    pub active: bool,
    pub total_purchases: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl AgentListing {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 1 + 8 + 8 + 8 + 1;
}

#[account]
pub struct AccessGrant {
    pub owner: Pubkey,
    pub listing: Pubkey,
    pub permanent: bool,
    pub expires_at: Option<i64>,
    pub remaining_runs: u32,
    pub usage_count: u64,
    pub last_purchase_at: i64,
    pub last_used_at: i64,
    pub bump: u8,
}

impl AccessGrant {
    pub const LEN: usize = 32 + 32 + 1 + 9 + 4 + 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PricingModel {
    Free,
    OneTime,
    Subscription,
    PayPerUse,
}

#[event]
pub struct MarketplaceInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_basis_points: u16,
}

#[event]
pub struct MarketplaceUpdated {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub fee_basis_points: u16,
}

#[event]
pub struct AgentRegistered {
    pub listing: Pubkey,
    pub creator: Pubkey,
    pub agent_id: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub price_lamports: u64,
    pub pricing_model: PricingModel,
}

#[event]
pub struct AgentUpdated {
    pub listing: Pubkey,
    pub metadata_hash: [u8; 32],
    pub price_lamports: u64,
    pub pricing_model: PricingModel,
    pub active: bool,
}

#[event]
pub struct AccessPurchased {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub pricing_model: PricingModel,
    pub price_lamports: u64,
    pub fee_lamports: u64,
    pub expires_at: Option<i64>,
    pub remaining_runs: u32,
}

#[event]
pub struct AccessConsumed {
    pub listing: Pubkey,
    pub owner: Pubkey,
    pub executor: Pubkey,
    pub usage_count: u64,
    pub remaining_runs: u32,
}

#[error_code]
pub enum MarketplaceError {
    #[msg("Marketplace fee cannot exceed 10%")]
    FeeTooHigh,
    #[msg("The supplied address is invalid")]
    InvalidAddress,
    #[msg("Only the marketplace authority may perform this action")]
    UnauthorizedAuthority,
    #[msg("Only the listing creator may perform this action")]
    UnauthorizedCreator,
    #[msg("The listing metadata hash cannot be empty")]
    InvalidMetadata,
    #[msg("Free listings must have a zero price")]
    InvalidFreePrice,
    #[msg("Paid listings must have a non-zero price")]
    InvalidPaidPrice,
    #[msg("This listing is paused")]
    ListingPaused,
    #[msg("The creator and marketplace treasury must be different accounts")]
    CreatorCannotBeTreasury,
    #[msg("The marketplace treasury account is invalid")]
    InvalidTreasury,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Permanent access has already been purchased")]
    AccessAlreadyPermanent,
    #[msg("The access owner is invalid")]
    InvalidAccessOwner,
    #[msg("The access grant does not belong to this listing")]
    InvalidListing,
    #[msg("The executor cannot consume this access grant")]
    UnauthorizedExecutor,
    #[msg("Access is not active")]
    AccessDenied,
    #[msg("The subscription has expired")]
    SubscriptionExpired,
    #[msg("No run credits remain")]
    NoRunCredits,
}

fn validate_listing(
    metadata_hash: [u8; 32],
    price_lamports: u64,
    pricing_model: PricingModel,
) -> Result<()> {
    require!(metadata_hash != [0; 32], MarketplaceError::InvalidMetadata);
    match pricing_model {
        PricingModel::Free => {
            require!(price_lamports == 0, MarketplaceError::InvalidFreePrice)
        }
        _ => require!(price_lamports > 0, MarketplaceError::InvalidPaidPrice),
    }
    Ok(())
}

fn calculate_fee(price_lamports: u64, fee_basis_points: u16) -> Result<u64> {
    price_lamports
        .checked_mul(u64::from(fee_basis_points))
        .ok_or(MarketplaceError::ArithmeticOverflow.into())
        .map(|value| value / BASIS_POINTS_DENOMINATOR)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_basis_point_fee() {
        assert_eq!(calculate_fee(1_000_000_000, 250).unwrap(), 25_000_000);
        assert_eq!(calculate_fee(500_000_000, 0).unwrap(), 0);
    }

    #[test]
    fn validates_free_and_paid_prices() {
        let metadata_hash = [7; 32];
        assert!(validate_listing(metadata_hash, 0, PricingModel::Free).is_ok());
        assert!(validate_listing(metadata_hash, 1, PricingModel::OneTime).is_ok());
        assert!(validate_listing(metadata_hash, 1, PricingModel::Free).is_err());
        assert!(validate_listing(metadata_hash, 0, PricingModel::PayPerUse).is_err());
    }
}
