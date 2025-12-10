// =============================================================================
// ACCESS MANAGER ROLE IDs
// =============================================================================
// Role IDs for the AroMediaAccessManager contract following OpenZeppelin's
// AccessManager pattern. Role 0 is reserved for ADMIN by the OZ contract.

/**
 * ORG_ADMIN (Role 0) - Full control
 * - Assign/revoke roles
 * - Manage global settings
 * - Emergency actions
 * Note: This maps to AccessManager's ADMIN_ROLE (public constant = 0)
 */
export const ROLE_ORG_ADMIN = 0n;

/**
 * PROTOCOL_ADMIN (Role 1)
 * - Manage protocol parameters
 * - Enable/disable features
 * - No treasury or minting powers
 */
export const ROLE_PROTOCOL_ADMIN = 1n;

/**
 * TREASURY_CONTROLLER (Role 2)
 * - Move/manage protocol funds
 * - Handle distributions + transfers
 * - No role changes or protocol edits
 */
export const ROLE_TREASURY_CONTROLLER = 2n;

/**
 * MARKET_MAKER / LIQUIDITY_MANAGER (Role 3)
 * - Manage liquidity
 * - Run buyback/sellback logic
 * - No mint/burn or role changes
 */
export const ROLE_MARKET_MAKER = 3n;

/**
 * MINTER (Role 4)
 * - Mint ERC-20/721/1155
 * - Scoped to specific assets
 */
export const ROLE_MINTER = 4n;

/**
 * BURNER (Role 5)
 * - Burn tokens
 * - Separate from Minter for safety
 */
export const ROLE_BURNER = 5n;

/**
 * PAUSER / SAFETY_OFFICER (Role 6)
 * - Pause/unpause contracts
 * - No mint, burn, or treasury access
 */
export const ROLE_PAUSER = 6n;

/**
 * OPERATOR (Role 7)
 * - Routine ops (lists, metadata, keys)
 * - No admin, treasury, or mint powers
 */
export const ROLE_OPERATOR = 7n;

/**
 * AUDITOR / COMPLIANCE_VIEW (Role 8)
 * - Read-only access
 * - No state-changing rights
 */
export const ROLE_AUDITOR = 8n;

/**
 * INTEGRATION_BOT / SERVICE_ACCOUNT (Role 9)
 * - Very limited, scoped permissions
 * - Automation + scheduled tasks only
 */
export const ROLE_INTEGRATION_BOT = 9n;

// Role labels for display/logging purposes
export const ROLE_LABELS: Record<bigint, string> = {
  [ROLE_ORG_ADMIN]: "ORG_ADMIN",
  [ROLE_PROTOCOL_ADMIN]: "PROTOCOL_ADMIN",
  [ROLE_TREASURY_CONTROLLER]: "TREASURY_CONTROLLER",
  [ROLE_MARKET_MAKER]: "MARKET_MAKER",
  [ROLE_MINTER]: "MINTER",
  [ROLE_BURNER]: "BURNER",
  [ROLE_PAUSER]: "PAUSER",
  [ROLE_OPERATOR]: "OPERATOR",
  [ROLE_AUDITOR]: "AUDITOR",
  [ROLE_INTEGRATION_BOT]: "INTEGRATION_BOT",
};

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

/**
 * Get the authority address from environment variables.
 * This address will own the AccessManager contract and must be set before deployment.
 * @returns Authority address from AUTHORITY env var
 * @throws Error if AUTHORITY env var is not set
 */
export function getAuthorityAddress(): string {
  const authority = process.env.AUTHORITY;
  
  if (!authority) {
    throw new Error(
      'AUTHORITY environment variable is not set. ' +
      'Please set AUTHORITY to the MultiSig or AccessManager address before deployment. ' +
      'Example: export AUTHORITY=0x1234567890abcdef1234567890abcdef12345678'
    );
  }
  
  // Validate that it looks like a valid Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(authority)) {
    throw new Error(
      `AUTHORITY environment variable "${authority}" is not a valid Ethereum address. ` +
      'Must be in format: 0x followed by 40 hexadecimal characters.'
    );
  }
  
  return authority;
}
