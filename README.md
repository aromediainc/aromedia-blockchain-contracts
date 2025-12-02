# Aro Media Smart Contracts

Aro Media's blockchain infrastructure for managing real-world assets (RWA), security tokens, and multi-signature governance.

## Overview

This repository contains three core smart contracts powering the Aro Media ecosystem:

### 1. **AroMediaAssetsRegistry** (ERC721)

An NFT-based registry contract for managing and tracking company assets including art, media, intellectual property, and physical items.

**Key Features:**

- ERC721 standard NFT implementation with enumerable support
- URI storage for asset metadata
- Pause/unpause functionality for emergency scenarios
- Access-controlled minting through AccessManaged
- Token-gating capabilities with ERC721Pausable

### 2. **AroMediaRWA** (ERC20)

A security token powering the Aro Media private, asset-backed ecosystem. Acts as the governance and utility token.

**Key Features:**

- ERC20 standard token with advanced extensions
- Vote delegation via ERC20Votes for governance
- Token freezing capabilities via ERC20Freezable
- Cross-chain bridging support via ERC20Bridgeable
- Permit functionality for gasless approvals (ERC2612)
- Comprehensive access control via AccessManaged
- Burn capability for token destruction
- User allowlist via ERC20Restricted
- Security contact: security@aro.media

### 3. **AroMediaIncMultiSig**

An advanced multi-signature smart contract wallet supporting complex signing schemes and account abstraction features.

**Key Features:**

- Multi-signature signing with configurable threshold
- ERC4337 account abstraction (EntryPoint integration)
- EIP-712 typed data signing
- ERC7739 advanced signature scheme support
- ERC7579 modular account extensions
- NFT and token receiving capabilities
- Dynamic signer management

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

The test suite includes 22 tests across four contracts:

**AroMediaAccessManager Tests (7 tests):**

- ✔ Deployment with correct owner
- ✔ Owner can transfer ownership
- ✔ Non-owner cannot transfer ownership
- ✔ Owner can renounce ownership
- ✔ Deployable as AccessManager for other contracts
- ✔ Role management support
- ✔ Works as authority for AccessManaged contracts

**AroMediaAssetsRegistry Tests (5 tests):**

- ✔ Contract deployment
- ✔ Token name and symbol validation
- ✔ Initial supply verification
- ✔ ERC721 interface detection
- ✔ Authority initialization

**AroMediaIncMultiSig Tests (3 tests):**

- ✔ Contract deployment with single signer
- ✔ Multiple signer configuration
- ✔ Threshold configuration

**AroMediaRWA Tests (7 tests):**

- ✔ Contract deployment
- ✔ Token name, symbol, and decimals
- ✔ Initial supply verification
- ✔ Voting clock mode
- ✔ ERC165 interface support
- ✔ Authority initialization
- ✔ Nonce tracking

All tests currently passing ✓

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
  - `AroMediaAssetsRegistry`: `pause()`, `unpause()`, `safeMint()`
  - `AroMediaRWA`: `pause()`, `unpause()`, `mint()`, `freeze()`, `allowUser()`, `disallowUser()`
  - `AroMediaIncMultiSig`: `addSigners()`, `removeSigners()`, `setThreshold()`

These functions require proper authorization through an `AccessManager` contract.

### Security Features

1. **ERC721URIStorage**: Secure metadata storage for NFTs
2. **ERC20Permit**: EIP-2612 permit-based approval mechanism
3. **ERC7739**: Advanced cryptographic signature validation
4. **ERC7579**: Modular account features
5. **Burnable Tokens**: Permanent token removal capability
6. **Freezable Assets**: Ability to freeze user token balances
7. **Multi-Signature Validation**: Multiple signer requirements

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
