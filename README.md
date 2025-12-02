# Aro Media Smart Contracts

Aro Media's blockchain infrastructure for managing real-world assets (RWA), security tokens, and multi-signature governance.

## Overview

This repository contains four core smart contracts powering the Aro Media ecosystem:

### 1. **AroMediaAccessManager**

A centralized access control manager for all Aro Media contracts, owned by the MultiSig wallet.

**Key Features:**

- Extends OpenZeppelin's `AccessManager` and `Ownable`
- Single source of truth for role-based access control
- Manages permissions for all `AccessManaged` contracts
- Supports role granting, revocation, and scheduling with delays
- Target function role configuration for fine-grained access control

### 2. **AroMediaAssetsRegistry** (ERC721)

An NFT-based registry contract for managing and tracking company assets including art, media, intellectual property, and physical items.

**Key Features:**

- ERC721 standard NFT implementation with enumerable support
- URI storage for asset metadata
- Pause/unpause functionality for emergency scenarios
- Access-controlled minting through AccessManaged
- Token-gating capabilities with ERC721Pausable

### 3. **AroMediaRWA** (ERC20)

A security token powering the Aro Media private, asset-backed ecosystem. Acts as the governance and utility token.

**Key Features:**

- ERC20 standard token with advanced extensions
- Vote delegation via ERC20Votes for governance
- Token freezing capabilities via ERC20Freezable
- Cross-chain bridging support via ERC20Bridgeable (Superchain)
- Permit functionality for gasless approvals (ERC2612)
- Comprehensive access control via AccessManaged
- Burn capability for token destruction
- **Strict allowlist** via ERC20Restricted (see [User Allowlist](#user-allowlist-strict-mode) below)
- Security contact: security@aro.media

### 4. **AroMediaIncMultiSig**

An advanced multi-signature smart contract wallet supporting complex signing schemes and account abstraction features.

**Key Features:**

- Multi-signature signing with configurable threshold
- ERC4337 account abstraction (EntryPoint integration)
- EIP-712 typed data signing
- ERC7739 advanced signature scheme support
- ERC7579 modular account extensions with hooks
- NFT and token receiving capabilities (ERC721, ERC1155)
- Dynamic signer management

#### Account Abstraction & Advanced Signing (ERC4337/ERC7579/ERC7739)

The MultiSig wallet implements several cutting-edge standards:

- **ERC4337 (Account Abstraction):** Enables smart contract wallets to initiate transactions, pay gas in tokens, and support advanced features like session keys and social recovery.
- **ERC7579 (Modular Account):** Provides a modular architecture allowing extensions and hooks for custom account logic.
- **ERC7739 (Advanced Signatures):** Supports multiple signature schemes and validation methods beyond standard ECDSA.

## User Allowlist (Strict Mode)

The `AroMediaRWA` token implements a **strict allowlist** model via `ERC20Restricted`:

> **Important:** Users are NOT allowed by default. They must be explicitly added to the allowlist via `allowUser()` before they can receive or transfer tokens.

```solidity
// Check if a user is allowed
bool allowed = token.isUserAllowed(userAddress); // Returns true ONLY if explicitly allowed

// Add user to allowlist (restricted function)
token.allowUser(userAddress);

// Remove user from allowlist (restricted function)
token.disallowUser(userAddress);
```

This differs from a typical blocklist approach where users are allowed by default. The strict allowlist ensures compliance with securities regulations by requiring explicit approval before token transfers.

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Testing

Run the comprehensive test suite:

```bash
npm test
```

### Test Coverage

The test suite includes comprehensive integration tests across four contracts:

**AroMediaAccessManager Tests:**

- ✔ Deployment with multiSigOwner as both owner and authority admin
- ✔ Deployer does not receive admin role (security fix)
- ✔ Owner can transfer ownership with event emission
- ✔ Non-owner cannot transfer ownership
- ✔ Owner can renounce ownership
- ✔ Admin can grant roles with RoleGranted event
- ✔ Admin can revoke roles with RoleRevoked event
- ✔ Non-admin cannot grant roles
- ✔ User can renounce their own role
- ✔ Admin can set target function roles with TargetFunctionRoleUpdated event
- ✔ Admin can close/open targets with TargetClosed event
- ✔ Authorized caller can execute restricted functions on AssetsRegistry
- ✔ Unauthorized caller blocked from restricted functions
- ✔ Authorized caller can execute restricted functions on RWA token
- ✔ Calls blocked when target is closed
- ✔ Role grants with execution delay
- ✔ Setting role grant delay

**AroMediaAssetsRegistry Tests:**

- ✔ Deployment with correct name, symbol
- ✔ Initial supply of zero
- ✔ ERC721, ERC721Enumerable, ERC721Metadata interface support
- ✔ safeMint with authority + Transfer event
- ✔ safeMint returns correct token ID
- ✔ safeMint reverts without authority
- ✔ safeMint reverts to zero address
- ✔ Token URI with base URI concatenation
- ✔ Token URI reverts for non-existent token
- ✔ pause/unpause with Paused/Unpaused events
- ✔ Unauthorized pause/unpause reverts
- ✔ Transfers blocked when paused
- ✔ Minting blocked when paused
- ✔ Transfers allowed after unpause
- ✔ Token owner can burn with Transfer event
- ✔ Non-owner burn reverts
- ✔ Approved operator can burn
- ✔ Enumerable: tokenByIndex, tokenOfOwnerByIndex
- ✔ Enumerable state updates after burn

**AroMediaIncMultiSig Tests:**

- ✔ Deployment with single/multiple signers
- ✔ Threshold configuration
- ✔ ERC721Holder and ERC1155Holder interface support
- ✔ Signer management functions available (addSigners, removeSigners, setThreshold)
- ✔ Signer management reverts for non-entrypoint/self callers
- ✔ isValidSignature returns invalid for empty/random signatures
- ✔ ERC721 token receiving with Transfer event
- ✔ onERC721Received returns correct magic value
- ✔ onERC1155Received and onERC1155BatchReceived magic values
- ✔ ETH receiving capability

**AroMediaRWA Tests:**

- ✔ Deployment with name, symbol, decimals
- ✔ Initial supply of zero
- ✔ CLOCK_MODE and clock() for voting
- ✔ ERC165 interface support
- ✔ Nonce initialization
- ✔ mint with authority + Transfer event
- ✔ mint reverts without authority
- ✔ mint reverts to non-allowed user (strict allowlist)
- ✔ allowUser/disallowUser functionality
- ✔ Unauthorized allowUser/disallowUser reverts
- ✔ Transfers blocked for non-allowed users
- ✔ Transfers allowed between allowed users
- ✔ pause/unpause with events
- ✔ Transfers/minting blocked when paused
- ✔ freeze with frozen()/available() verification
- ✔ Transfers blocked when exceeding available balance
- ✔ Transfers allowed within available balance
- ✔ Unauthorized freeze reverts
- ✔ Unfreezing by setting freeze to 0
- ✔ burn and burnFrom with Transfer event
- ✔ ERC20Permit: permit-based approvals with signature
- ✔ Permit reverts with expired deadline
- ✔ ERC20Votes: delegate with DelegateChanged event
- ✔ Self-delegation
- ✔ Voting power updates after transfers
- ✔ Historical voting power with getPastVotes
- ✔ Approval and transferFrom

All tests passing ✓

## Deployment

### Prerequisites

Before deploying, ensure you have:

1. **Environment Variables Configured**

```bash
# Copy the example env file
cp .env.example .env

# Configure the following variables:
AUTHORITY=<MultiSig or AccessManager address>  # Falls back to dead address if not set
```

2. **Network Configuration**

Edit `hardhat.config.ts` to add your network RPC endpoints and ensure proper network configuration.

### Using Hardhat Ignition

Hardhat Ignition orchestrates contract deployments with proper dependency management. The deployment flow follows this order:

1. **AroMediaAccessManager** - Deployed first, owned by the MultiSig
2. **AroMediaAssetsRegistry** - Uses AccessManager as authority
3. **AroMediaRWA** - Uses AccessManager as authority
4. **AroMediaIncMultiSig** - Multi-sig wallet for governance

#### Step 1: Deploy AccessManager

```bash
npx hardhat ignition deploy ignition/modules/AroMediaAccessManager.ts --network <network-name>
```

The AccessManager will be owned by the address specified in the `AUTHORITY` environment variable or default to the dead address (`0x0000...0000`).

#### Step 2: Deploy Other Contracts

The other contracts can be deployed in any order as they all reference the AccessManager:

```bash
# Deploy AroMediaAssetsRegistry
npx hardhat ignition deploy ignition/modules/AroMediaAssetsRegistry.ts --network <network-name>

# Deploy AroMediaRWA
npx hardhat ignition deploy ignition/modules/AroMediaRWA.ts --network <network-name>

# Deploy AroMediaIncMultiSig (requires signers and threshold)
npx hardhat ignition deploy ignition/modules/AroMediaIncMultiSig.ts --network <network-name>
```

#### Example: Full Deployment with Environment Variables

```bash
# Set the MultiSig address as authority
export AUTHORITY=0x1234567890abcdef1234567890abcdef12345678

# Deploy to Sepolia testnet
npx hardhat ignition deploy ignition/modules/AroMediaAccessManager.ts --network sepolia
npx hardhat ignition deploy ignition/modules/AroMediaAssetsRegistry.ts --network sepolia
npx hardhat ignition deploy ignition/modules/AroMediaRWA.ts --network sepolia
npx hardhat ignition deploy ignition/modules/AroMediaIncMultiSig.ts --network sepolia
```

### Supported Networks

- **Hardhat** - Local testing and development
- **Sepolia** - Ethereum testnet
- **Mainnet** - Ethereum production (use with caution)
- **Optimism and other Superchain networks** - For ERC20Bridgeable support

### Deployment Outputs

After deployment, Hardhat Ignition creates:
- `ignition/deployments/<network>/` folder containing deployment data
- `ignition/deployments/<network>/deployment-manifest.json` with all deployed addresses

Save these addresses for contract interactions and verification.

## Contract Verification

After deployment, verify your contracts on block explorers (e.g., Etherscan) to ensure transparency and user trust.

### Using Hardhat-Verify

Install the Hardhat verification plugin:

```bash
npm install --save-dev @nomicfoundation/hardhat-verify
```

Configure in `hardhat.config.ts`:

```typescript
import "@nomicfoundation/hardhat-verify";

export default {
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
  },
};
```

### Verification Commands

Verify individual contracts using the deployed addresses:

```bash
# Verify AroMediaAccessManager
npx hardhat verify --network <network-name> <AccessManager_Address> <MultiSig_Owner_Address>

# Verify AroMediaAssetsRegistry
npx hardhat verify --network <network-name> <Registry_Address> <AccessManager_Address>

# Verify AroMediaRWA
npx hardhat verify --network <network-name> <RWA_Address> <AccessManager_Address>

# Verify AroMediaIncMultiSig
npx hardhat verify --network <network-name> <MultiSig_Address> <signers_array> <threshold>
```

### Example Verification

```bash
# Get deployed addresses from ignition/deployments/<network>/deployment-manifest.json

# Verify AccessManager (assuming address: 0xabc...)
npx hardhat verify --network sepolia 0xabc123... 0xdef456...

# Verify Assets Registry
npx hardhat verify --network sepolia 0xghi789... 0xabc123...

# Verify RWA Token
npx hardhat verify --network sepolia 0xjkl012... 0xabc123...
```

### Manual Verification

If automatic verification fails:

1. Go to your network's block explorer (e.g., etherscan.io)
2. Navigate to your contract address
3. Click "Contract" tab → "Verify and Publish"
4. Choose verification method:
   - **Solidity (Standard-json-input)** - Upload compiled JSON from `artifacts/`
   - **Solidity (Flattened)** - Provide flattened source code
   - **Solidity (Multi-file)** - Upload multiple files

### Verification Checklist

- [ ] Obtain correct contract address from deployment manifest
- [ ] Gather correct constructor arguments (encode with ABI if needed)
- [ ] Ensure compiler version matches (^0.8.27)
- [ ] Verify optimization settings (check `hardhat.config.ts`)
- [ ] Confirm all dependencies are properly linked
- [ ] Test verification on testnet before mainnet

## Contract Architecture

### Access Control

All contracts implement `AccessManaged` from OpenZeppelin Contracts v5.5.0, providing role-based access control:

- **Restricted Functions:**
  - `AroMediaAccessManager`: All AccessManager functions (grantRole, revokeRole, setTargetFunctionRole, etc.) require admin role
  - `AroMediaAssetsRegistry`: `pause()`, `unpause()`, `safeMint()`
  - `AroMediaRWA`: `pause()`, `unpause()`, `mint()`, `freeze()`, `allowUser()`, `disallowUser()`
  - `AroMediaIncMultiSig`: `addSigners()`, `removeSigners()`, `setThreshold()` (require EntryPoint or self-call)

These functions require proper authorization through an `AccessManager` contract.

### Security Features

1. **AccessManager Authority**: Single source of truth for all role-based permissions
2. **ERC721URIStorage**: Secure metadata storage for NFTs
3. **ERC20Permit**: EIP-2612 permit-based approval mechanism
4. **ERC7739**: Advanced cryptographic signature validation
5. **ERC7579**: Modular account features with hooks
6. **ERC4337**: Account abstraction for smart contract wallets
7. **Burnable Tokens**: Permanent token removal capability
8. **Freezable Assets**: Ability to freeze specific amounts per user
9. **Strict Allowlist**: Users must be explicitly allowed before transfers
10. **Multi-Signature Validation**: Multiple signer requirements with configurable threshold
11. **Pausable Contracts**: Emergency pause capability for NFT and token contracts

## API Reference

### AroMediaAccessManager

| Function | Access | Description |
|----------|--------|-------------|
| `grantRole(uint64 roleId, address account, uint32 executionDelay)` | Admin | Grant a role to an account |
| `revokeRole(uint64 roleId, address account)` | Admin | Revoke a role from an account |
| `renounceRole(uint64 roleId, address callerConfirmation)` | Role holder | Renounce your own role |
| `setTargetFunctionRole(address target, bytes4[] selectors, uint64 roleId)` | Admin | Set required role for target functions |
| `setTargetClosed(address target, bool closed)` | Admin | Close/open a target contract |
| `setGrantDelay(uint64 roleId, uint32 newDelay)` | Admin | Set grant delay for a role |
| `hasRole(uint64 roleId, address account)` | View | Check if account has role |
| `transferOwnership(address newOwner)` | Owner | Transfer contract ownership |
| `renounceOwnership()` | Owner | Renounce contract ownership |

### AroMediaAssetsRegistry

| Function | Access | Description |
|----------|--------|-------------|
| `safeMint(address to, string uri)` | Restricted | Mint new NFT with metadata URI |
| `burn(uint256 tokenId)` | Token owner/approved | Burn a token |
| `pause()` | Restricted | Pause all token transfers |
| `unpause()` | Restricted | Unpause token transfers |
| `tokenURI(uint256 tokenId)` | View | Get token metadata URI |
| `totalSupply()` | View | Get total number of tokens |
| `tokenByIndex(uint256 index)` | View | Get token ID at index |
| `tokenOfOwnerByIndex(address owner, uint256 index)` | View | Get token of owner at index |
| `supportsInterface(bytes4 interfaceId)` | View | ERC165 interface detection |

### AroMediaRWA

| Function | Access | Description |
|----------|--------|-------------|
| `mint(address to, uint256 amount)` | Restricted | Mint new tokens |
| `burn(uint256 amount)` | Token holder | Burn your tokens |
| `burnFrom(address account, uint256 amount)` | Approved | Burn from approved account |
| `pause()` | Restricted | Pause all token transfers |
| `unpause()` | Restricted | Unpause token transfers |
| `freeze(address user, uint256 amount)` | Restricted | Freeze specific amount for user |
| `frozen(address user)` | View | Get frozen amount for user |
| `available(address user)` | View | Get available (unfrozen) balance |
| `allowUser(address user)` | Restricted | Add user to allowlist |
| `disallowUser(address user)` | Restricted | Remove user from allowlist |
| `isUserAllowed(address user)` | View | Check if user is explicitly allowed |
| `delegate(address delegatee)` | Token holder | Delegate voting power |
| `getVotes(address account)` | View | Get current voting power |
| `getPastVotes(address account, uint256 timepoint)` | View | Get historical voting power |
| `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` | Public | Gasless approval via signature |
| `clock()` | View | Get current voting clock (timestamp) |
| `CLOCK_MODE()` | View | Get clock mode string |

### AroMediaIncMultiSig

| Function | Access | Description |
|----------|--------|-------------|
| `addSigners(bytes[] signers)` | EntryPoint/Self | Add new signers |
| `removeSigners(bytes[] signers)` | EntryPoint/Self | Remove signers |
| `setThreshold(uint64 threshold)` | EntryPoint/Self | Update signing threshold |
| `isValidSignature(bytes32 hash, bytes signature)` | View | Validate signature (ERC1271) |
| `onERC721Received(...)` | Public | ERC721 token receiver |
| `onERC1155Received(...)` | Public | ERC1155 token receiver |
| `onERC1155BatchReceived(...)` | Public | ERC1155 batch token receiver |

## Dependencies

- **@openzeppelin/contracts** (v5.5.0): Industry-standard contract implementations
- **openzeppelin-community-contracts**: Community-maintained contract extensions
- **hardhat**: Development and testing framework
- **ethers.js**: Blockchain interaction library
- **typescript**: Type-safe contract development

## Security Considerations

### Audits

For production deployments, conduct thorough security audits of all contracts.

### Vulnerability Reporting

Security vulnerabilities should be reported to **security@aro.media**

Do not disclose vulnerabilities publicly before a fix is released.

### Best Practices

1. Use `AccessManager` for fine-grained access control before production
2. Configure appropriate threshold values for `AroMediaIncMultiSig`
3. Test token freezing and allowlist features thoroughly
4. Maintain secure custody of private keys for signers
5. Monitor cross-chain bridging operations carefully

## Contract Interactions

### Minting an Asset NFT

```typescript
const registry = new ethers.Contract(
  registryAddress,
  AroMediaAssetsRegistryABI,
  signer
);

const tokenId = await registry.safeMint(
  ownerAddress,
  "ipfs://metadata-hash"
);
```

### Minting Security Tokens

```typescript
const token = new ethers.Contract(
  tokenAddress,
  AroMediaRWAABI,
  signer
);

await token.mint(recipientAddress, ethers.parseEther("1000"));
```

### Multi-Signature Operations

```typescript
const wallet = new ethers.Contract(
  walletAddress,
  AroMediaIncMultiSigABI,
  signer
);

// Add signers
await wallet.addSigners([newSignerAddress]);

// Update threshold
await wallet.setThreshold(2);
```

## License

BUSL-1.1 (Business Source License) - See individual contract headers for details.

## Support

For technical support or questions:

- Create an issue in this repository
- Contact: security@aro.media

## Development Team

**Aro Media Dev Lab**

Follow the code comments for implementation notes and security guidance embedded throughout the contracts.
