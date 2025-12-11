<h1 align="center">Aro Media Blockchain Smart Contracts</h1>

<p align="center">
    <i> A comprehensive smart contract suite for tokenizing, governing, and securing real-world asset-backed securities on the blockchain. </i>
</p>

<h3 align="center">Blockchain Infrastructure for Aro Media's Real-World Assets</h3>

<p align="center">
  <a href="https://spdx.org/licenses/BUSL-1.1.html">
    <img src="https://img.shields.io/badge/License-BUSL--1.1-blue.svg" alt="License: BUSL-1.1">
  </a>
  <a href="https://soliditylang.org/">
    <img src="https://img.shields.io/badge/Solidity-^0.8.27-363636.svg" alt="Solidity">
  </a>
  <a href="https://openzeppelin.com/contracts/">
    <img src="https://img.shields.io/badge/OpenZeppelin-v5.5.0-4E5EE4.svg" alt="OpenZeppelin">
  </a>
  <a href="#testing">
    <img src="https://img.shields.io/badge/Tests-151%20passing-brightgreen.svg" alt="Tests">
  </a>
</p>

<p align="center">
  <a href="#getting-started">Getting Started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#security">Security</a>
</p>

---

## About

Aro Media is building the infrastructure layer for real-world asset tokenization. Our smart contracts enables the organization to create verifiable on-chain representations of physical and digital assets, govern them through secure multi-signature processes, and trade them as compliant security tokens.

This repository contains the core protocol: five interdependent contracts that work together to provide end-to-end asset management with enterprise-grade security controls.

---

## The Protocol

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   ┌─────────────────┐         ┌─────────────────────────────────┐          │
│   │                 │         │                                 │          │
│   │   MultiSig      │────────▶│      Access Manager             │          │
│   │   Wallet        │  owns   │   (Central Permission Hub)      │          │
│   │                 │         │                                 │          │
│   └─────────────────┘         └─────────────┬───────────────────┘          │
│                                             │                              │
│                                             │ authorizes                   │
│                      ┌──────────────────────┼──────────────────────┐       │
│                      │                      │                      │       │
│                      ▼                      ▼                      ▼       │
│          ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│          │                   │  │                   │  │    Forced         │
│          │  Assets Registry  │  │    RWA Token      │  │    Transfer       │
│          │     (ERC721)      │  │     (ERC20)       │  │    Manager        │
│          │                   │  │                   │  │                   │
│          └─────────┬─────────┘  └─────────┬─────────┘  └────────┬──────────┘
│                    │                      │                     │          │
│                    └──────────────────────┴─────────────────────┘          │
│                                    │                                       │
│                          dossier proof + execution                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Access Manager

The central authority for the entire protocol. Every privileged operation flows through here.

- **Role-based permissions** with configurable delays
- **Target function control** — define exactly which addresses can call which functions
- **Emergency controls** — close access to any contract instantly
- **Role labeling** — human-readable names for all roles via `getRoleLabel()`
- Owned by the MultiSig for decentralized governance

#### Roles

The Access Manager defines 10 roles for fine-grained access control:

| Role ID | Name                    | Permissions                                          |
| ------- | ----------------------- | ---------------------------------------------------- |
| 0       | `ORG_ADMIN`           | Full control. Assign/revoke roles, emergency actions |
| 1       | `PROTOCOL_ADMIN`      | Manage protocol parameters, enable/disable features  |
| 2       | `TREASURY_CONTROLLER` | Move/manage protocol funds, handle distributions     |
| 3       | `MARKET_MAKER`        | Manage liquidity, run buyback/sellback logic         |
| 4       | `MINTER`              | Mint ERC-20/721/1155 tokens (scoped to assets)       |
| 5       | `BURNER`              | Burn tokens (separate from Minter for safety)        |
| 6       | `PAUSER`              | Pause/unpause contracts                              |
| 7       | `OPERATOR`            | Routine ops (allowlists, metadata, keys)             |
| 8       | `AUDITOR`             | Read-only compliance access                          |
| 9       | `INTEGRATION_BOT`     | Limited automation and scheduled tasks               |

#### Role → Function Wiring

After deployment, the owner (MultiSig) must wire roles to contract functions:

```solidity
// Wire all contracts in a single transaction
accessManager.wireAllContracts(rwaTokenAddress, assetsRegistryAddress, forcedTransferManagerAddress);

// Or wire individually
accessManager.wireRWAToken(rwaTokenAddress);
accessManager.wireAssetsRegistry(assetsRegistryAddress);
accessManager.wireForcedTransferManager(forcedTransferManagerAddress);
```

**AroMediaRWA (ERC-20):**

| Function                     | Required Role      |
| ---------------------------- | ------------------ |
| `issue`                    | MINTER (4)         |
| `pause/unpause`            | PAUSER (6)         |
| `allowUser`                | OPERATOR (7)       |
| `disallowUser`             | OPERATOR (7)       |
| `freeze`                   | OPERATOR (7)       |
| `setForcedTransferManager` | PROTOCOL_ADMIN (1) |

**ForcedTransferManager:**

| Function            | Required Role           |
| ------------------- | ----------------------- |
| `configure`       | ORG_ADMIN (0)           |
| `initiate`        | TREASURY_CONTROLLER (2) |
| `approveTreasury` | TREASURY_CONTROLLER (2) |
| `approveAuditor`  | AUDITOR (8)             |
| `approveOrgAdmin` | ORG_ADMIN (0)           |
| `execute`         | TREASURY_CONTROLLER (2) |
| `cancel`          | ORG_ADMIN (0)           |

**AroMediaAssetsRegistry (ERC-721):**

| Function          | Required Role |
| ----------------- | ------------- |
| `safeMint`      | MINTER (4)    |
| `pause/unpause` | PAUSER (6)    |

### Assets Registry

An NFT registry for company assets. Each token represents ownership or provenance of a real-world item.

- Artwork, media files, intellectual property, physical items
- On-chain metadata via URI storage
- Emergency pause for all transfers
- Enumerable for easy discovery and indexing

### RWA Token

The security token powering the ecosystem. Designed for compliance-first token distribution.

- **Strict allowlist** — users must be approved before receiving tokens
- **Token freezing** — lock specific amounts per wallet
- **Governance-ready** — built-in vote delegation
- **Gas-efficient** — permit-based approvals (no approve transaction needed)

### MultiSig Wallet

A next-generation smart contract wallet for organizational governance.

- Configurable M-of-N signing threshold
- ERC-4337 account abstraction (pay gas in tokens, batched transactions)
- Modular extensions via ERC-7579
- Can hold ETH, ERC-20, ERC-721, and ERC-1155 tokens

### Forced Transfer Manager

Regulatory-compliant forced transfer workflow for securities compliance and legal obligations.

- **Three-party approval** — Treasury Controller, Auditor, and Org Admin must all sign off
- **Dossier NFT proof** — Each transfer requires a linked NFT from the Assets Registry as verifiable documentation
- **Separation of duties** — Initiator cannot self-approve
- **Full audit trail** — All actions emit events for compliance tracking
- **ERC-7943 compatible** — Standardized forced transfer interface

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/AroMedia/aromedia.git
cd aromedia

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

Edit `.env` with your configuration. See [Environment Variables](#environment-variables) for details.

### Quick Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local network
npx hardhat ignition deploy ignition/modules/AroMediaAccessManager.ts
```

---

## Architecture

### How It All Connects

The protocol follows a hub-and-spoke model where the **Access Manager** sits at the center:

1. The **MultiSig** wallet owns the Access Manager
2. The Access Manager grants roles to addresses
3. Roles determine who can call restricted functions on managed contracts
4. All restricted operations check back with the Access Manager before executing

This architecture means:

- ✅ Single point of permission management
- ✅ Audit-friendly (one contract to review for access logic)
- ✅ Upgradeable permissions without redeploying tokens
- ✅ Emergency shutoff for any or all contracts

### The Allowlist Model

Unlike typical tokens where anyone can receive transfers, `AroMediaRWA` implements a **strict allowlist**:

```solidity
// ❌ This will fail — user2 is not on the allowlist
token.transfer(user2, 1000);

// ✅ First, an authorized operator must allow the recipient
token.allowUser(user2);

// ✅ Now transfers work
token.transfer(user2, 1000);
```

This is designed for securities compliance where KYC/AML verification must occur before token ownership.

### Token Freezing

Administrators can freeze a specific amount of tokens in any wallet:

```solidity
// User has 1000 tokens
token.freeze(user, 600);

// Now they can only transfer 400 (the unfrozen portion)
token.available(user); // Returns 400
token.frozen(user);    // Returns 600
```

This enables compliance holds, dispute resolution, or staged vesting.

---

## Testing

The test suite covers 151 scenarios across all five contracts:

```bash
npm test
```

Tests are organized by contract and use shared fixtures for realistic integration testing. Each test verifies both the happy path and error conditions, including event emissions.

| Contract                | Tests | Coverage Focus                                                 |
| ----------------------- | ----- | -------------------------------------------------------------- |
| Access Manager          | 18    | Role management, target configuration, integration             |
| Assets Registry         | 31    | Minting, burning, pausing, enumeration                         |
| MultiSig                | 23    | Signer management, signature validation, token receiving       |
| RWA Token               | 36    | Allowlist, freezing, voting, permits                           |
| Forced Transfer Manager | 43    | Three-party approval workflow, dossier verification, execution |

---

## Deployment

### Recommended Order

1. **Deploy MultiSig** — This becomes your governance wallet
2. **Deploy Access Manager** — Pass the MultiSig address as owner
3. **Deploy Registry, Token & Forced Transfer Manager** — Pass the Access Manager address as authority
4. **Configure Roles** — Grant roles and wire functions through the Access Manager
5. **Link Contracts** — Configure ForcedTransferManager with token and registry addresses

### Post-Deployment Role Setup

After deploying all contracts, the MultiSig owner must:

```solidity
// 1. Wire function permissions (as owner)
accessManager.wireAllContracts(rwaTokenAddress, assetsRegistryAddress, forcedTransferManagerAddress);

// 2. Grant roles to appropriate addresses (as admin)
accessManager.grantRole(ROLE_MINTER, minterAddress, 0);                // Minting authority
accessManager.grantRole(ROLE_PAUSER, safetyOfficer, 0);                // Emergency pause
accessManager.grantRole(ROLE_OPERATOR, operatorAddress, 0);            // Allowlist management
accessManager.grantRole(ROLE_PROTOCOL_ADMIN, protocolAdmin, 0);        // Protocol configuration
accessManager.grantRole(ROLE_TREASURY_CONTROLLER, treasuryAddr, 0);    // Forced transfers
accessManager.grantRole(ROLE_AUDITOR, auditorAddress, 0);              // Compliance signoff

// 3. Configure ForcedTransferManager (as ORG_ADMIN)
forcedTransferManager.configure(rwaTokenAddress, assetsRegistryAddress);

// 4. Link ForcedTransferManager to RWA Token (as PROTOCOL_ADMIN)
rwaToken.setForcedTransferManager(forcedTransferManagerAddress);
```

### Using Hardhat Ignition

**Deploy All Contracts (Recommended):**

```bash
# Set environment variables
export MULTISIG_SIGNERS="0xAddr1,0xAddr2,0xAddr3"
export MULTISIG_THRESHOLD=2

# Deploy all contracts in correct order
npx hardhat run scripts/deploy-all.ts --network base-sepolia
```

The `deploy-all.ts` script handles the full deployment in the correct order:
1. MultiSig Wallet
2. Access Manager (uses MultiSig as authority)
3. RWA Token (uses Access Manager)
4. Assets Registry (uses Access Manager)
5. Forced Transfer Manager (uses Access Manager)

**Deploy Individually:**

```bash
npx hardhat ignition deploy ignition/modules/AroMediaIncMultiSig.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaAccessManager.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaAssetsRegistry.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaRWA.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/ForcedTransferManager.ts --network base-sepolia
```

### Verification

**Verify All Contracts (Recommended):**

```bash
# Automatically reads deployed addresses and constructor args from Ignition logs
npx hardhat run scripts/verify-all.ts --network base-sepolia
```

The `verify-all.ts` script:
- Reads deployed addresses from `ignition/deployments/<chain>/deployed_addresses.json`
- Extracts constructor arguments from Ignition's journal
- Runs verification for each contract on the block explorer
- Provides direct explorer links for verified contracts

**Verify Individually:**

```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Deployed addresses are saved in `ignition/deployments/<network>/deployed_addresses.json`.

---

## Environment Variables

| Variable               | Required         | Description                              |
| ---------------------- | ---------------- | ---------------------------------------- |
| `WALLET_KEY`           | Yes              | Deployer wallet private key              |
| `MULTISIG_SIGNERS`     | Yes              | Comma-separated signer addresses         |
| `MULTISIG_THRESHOLD`   | Yes              | Required signatures (e.g., `2`)          |
| `BASE_SEPOLIA_RPC_URL` | For deployment   | RPC endpoint                             |
| `BASESCAN_API_KEY`     | For verification | Block explorer API key                   |

See `.env.example` for a complete template.

---

## Documentation

### Contract Reference

<details>
<summary><strong>AroMediaAccessManager</strong></summary>

The permission layer for all protocol contracts.

**Role Management:**

| Function                                             | Who Can Call | What It Does                             |
| ---------------------------------------------------- | ------------ | ---------------------------------------- |
| `grantRole(roleId, account, delay)`                | Admin        | Give an address a role                   |
| `revokeRole(roleId, account)`                      | Admin        | Remove a role from an address            |
| `setTargetFunctionRole(target, selectors, roleId)` | Admin        | Assign a role requirement to functions   |
| `setTargetClosed(target, closed)`                  | Admin        | Emergency: block all calls to a contract |
| `transferOwnership(newOwner)`                      | Owner        | Change the owner (typically MultiSig)    |

**Role Wiring (Owner Only):**

| Function                                                       | What It Does                                  |
| -------------------------------------------------------------- | --------------------------------------------- |
| `wireRWAToken(rwaToken)`                                     | Configure roles for RWA token functions       |
| `wireAssetsRegistry(assetsRegistry)`                         | Configure roles for Assets Registry functions |
| `wireForcedTransferManager(forcedTransferManager)`           | Configure roles for Forced Transfer Manager   |
| `wireAllContracts(rwaToken, assetsRegistry, forcedTransfer)` | Configure all managed contracts in one tx     |

**Role Utilities:**

| Function                 | What It Does                          |
| ------------------------ | ------------------------------------- |
| `getRoleLabel(roleId)` | Get human-readable name for a role ID |
| `getAllRoles()`        | Get all role IDs and their labels     |
| `ROLE_COUNT`           | Total number of defined roles (10)    |

**Role Constants:**

| Constant                     | Value | Description                       |
| ---------------------------- | ----- | --------------------------------- |
| `ROLE_ORG_ADMIN`           | 0     | Full control, admin of all roles  |
| `ROLE_PROTOCOL_ADMIN`      | 1     | Protocol parameter management     |
| `ROLE_TREASURY_CONTROLLER` | 2     | Fund management and distributions |
| `ROLE_MARKET_MAKER`        | 3     | Liquidity operations              |
| `ROLE_MINTER`              | 4     | Token minting                     |
| `ROLE_BURNER`              | 5     | Token burning                     |
| `ROLE_PAUSER`              | 6     | Contract pause/unpause            |
| `ROLE_OPERATOR`            | 7     | Routine operations                |
| `ROLE_AUDITOR`             | 8     | Read-only compliance access       |
| `ROLE_INTEGRATION_BOT`     | 9     | Automation and scheduled tasks    |

</details>

<details>
<summary><strong>AroMediaAssetsRegistry</strong></summary>

ERC-721 NFTs representing real-world assets.

| Function                    | Who Can Call    | What It Does               |
| --------------------------- | --------------- | -------------------------- |
| `safeMint(to, uri)`       | Authorized role | Create a new asset NFT     |
| `burn(tokenId)`           | Token owner     | Destroy an NFT             |
| `pause()` / `unpause()` | Authorized role | Emergency transfer control |
| `tokenURI(tokenId)`       | Anyone          | Get metadata location      |

Base URI: `https://aro.media/asset-registry/`

</details>

<details>
<summary><strong>AroMediaRWA</strong></summary>

ERC-20 security token with compliance features.

| Function                           | Who Can Call            | What It Does                  |
| ---------------------------------- | ----------------------- | ----------------------------- |
| `issue(to, amount)`              | Authorized role         | Create new tokens             |
| `allowUser(user)`                | Authorized role         | Add to transfer allowlist     |
| `disallowUser(user)`             | Authorized role         | Remove from allowlist         |
| `freeze(user, amount)`           | Authorized role         | Lock tokens in a wallet       |
| `setForcedTransferManager(addr)` | PROTOCOL_ADMIN          | Link to ForcedTransferManager |
| `forcedTransfer(from, to, amt)`  | ForcedTransferManager   | Execute regulatory transfer   |
| `delegate(delegatee)`            | Token holder            | Assign voting power           |
| `permit(...)`                    | Anyone (with valid sig) | Gasless approval              |

</details>

<details>
<summary><strong>AroMediaIncMultiSig</strong></summary>

Smart contract wallet for governance.

| Function                        | Who Can Call    | What It Does               |
| ------------------------------- | --------------- | -------------------------- |
| `addSigners(signers)`         | Self/EntryPoint | Add authorized signers     |
| `removeSigners(signers)`      | Self/EntryPoint | Remove signers             |
| `setThreshold(n)`             | Self/EntryPoint | Change required signatures |
| `isValidSignature(hash, sig)` | Anyone          | ERC-1271 signature check   |

Supports receiving ETH, ERC-20, ERC-721, and ERC-1155.

</details>

<details>
<summary><strong>ForcedTransferManager</strong></summary>

Regulatory-compliant forced transfer workflow with three-party approval.

**Workflow:**

1. TREASURY_CONTROLLER initiates with dossier NFT proof
2. Different TREASURY_CONTROLLER approves (separation of duties)
3. AUDITOR reviews and approves
4. ORG_ADMIN gives final approval
5. TREASURY_CONTROLLER executes the transfer

**Configuration:**

| Function                        | Who Can Call | What It Does                     |
| ------------------------------- | ------------ | -------------------------------- |
| `configure(token, registry)`  | ORG_ADMIN    | Set token and registry addresses |
| `setRWAToken(token)`          | ORG_ADMIN    | Update RWA token address         |
| `setAssetsRegistry(registry)` | ORG_ADMIN    | Update Assets Registry address   |

**Initiation & Execution:**

| Function                                        | Who Can Call        | What It Does                       |
| ----------------------------------------------- | ------------------- | ---------------------------------- |
| `initiate(from, to, amount, dossier, reason)` | TREASURY_CONTROLLER | Create new forced transfer request |
| `approveTreasury(requestId)`                  | TREASURY_CONTROLLER | Treasury signoff (not initiator)   |
| `approveAuditor(requestId)`                   | AUDITOR             | Auditor compliance signoff         |
| `approveOrgAdmin(requestId)`                  | ORG_ADMIN           | Final organizational approval      |
| `execute(requestId)`                          | TREASURY_CONTROLLER | Execute fully-approved transfer    |
| `cancel(requestId)`                           | ORG_ADMIN           | Cancel pending/approved request    |

**View Functions:**

| Function                   | What It Does                                  |
| -------------------------- | --------------------------------------------- |
| `getRequest(id)`         | Get full details of a forced transfer request |
| `getRequestCount()`      | Total number of requests created              |
| `isDossierUsed(tokenId)` | Check if a dossier NFT has been used          |
| `isFullyApproved(id)`    | Check if all three approvals are complete     |

</details>

---

## Security

### Reporting Vulnerabilities

**Please do not open public issues for security vulnerabilities.**

Email: **security@aro.media**

We follow responsible disclosure. Valid reports may be eligible for our bug bounty program.

### Audit Status

These contracts have not yet been audited. A professional security audit is planned before mainnet deployment.

### Best Practices

When deploying to production:

1. Use a hardware wallet for the deployer account
2. Set up the MultiSig with geographically distributed signers
3. Start with a conservative threshold (e.g., 3-of-5)
4. Test the full permission flow on testnet first
5. Keep the Access Manager owner key in cold storage

---

## Contributing

We welcome contributions. Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

---

## License

This project is licensed under the **Business Source License 1.1** (BUSL-1.1).

You may use this code for non-production purposes. For commercial/production use, please contact Aro Media Inc. for licensing.

---

<div align="center">

**Built by [Aro Media Dev Lab](https://aro.media)**

</div>
