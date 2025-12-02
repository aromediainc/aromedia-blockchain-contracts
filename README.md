<div align="center">

# Aro Media

### Blockchain Infrastructure for Real-World Assets

[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](https://spdx.org/licenses/BUSL-1.1.html)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.27-363636.svg)](https://soliditylang.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-v5.5.0-4E5EE4.svg)](https://openzeppelin.com/contracts/)
[![Tests](https://img.shields.io/badge/Tests-108%20passing-brightgreen.svg)](#testing)

*A comprehensive smart contract suite for tokenizing, governing, and securing real-world assets on the blockchain.*

[Getting Started](#getting-started) · [Architecture](#architecture) · [Documentation](#documentation) · [Security](#security)

</div>

---

## About

Aro Media is building the infrastructure layer for real-world asset tokenization. Our smart contracts enable organizations to create verifiable on-chain representations of physical and digital assets, govern them through secure multi-signature processes, and trade them as compliant security tokens.

This repository contains the core protocol: four interdependent contracts that work together to provide end-to-end asset management with enterprise-grade security controls.

---

## The Protocol

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ┌─────────────────┐         ┌─────────────────────────────────┐  │
│   │                 │         │                                 │  │
│   │   MultiSig      │────────▶│      Access Manager             │  │
│   │   Wallet        │  owns   │   (Central Permission Hub)      │  │
│   │                 │         │                                 │  │
│   └─────────────────┘         └─────────────┬───────────────────┘  │
│                                             │                       │
│                                             │ authorizes            │
│                               ┌─────────────┴───────────────┐      │
│                               │                             │      │
│                               ▼                             ▼      │
│                   ┌───────────────────┐       ┌───────────────────┐│
│                   │                   │       │                   ││
│                   │  Assets Registry  │       │    RWA Token      ││
│                   │     (ERC721)      │       │     (ERC20)       ││
│                   │                   │       │                   ││
│                   └───────────────────┘       └───────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Access Manager

The central authority for the entire protocol. Every privileged operation flows through here.

- **Role-based permissions** with configurable delays
- **Target function control** — define exactly which addresses can call which functions
- **Emergency controls** — close access to any contract instantly
- Owned by the MultiSig for decentralized governance

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
- **Cross-chain** — Superchain bridge support

### MultiSig Wallet

A next-generation smart contract wallet for organizational governance.

- Configurable M-of-N signing threshold
- ERC-4337 account abstraction (pay gas in tokens, batched transactions)
- Modular extensions via ERC-7579
- Can hold ETH, ERC-20, ERC-721, and ERC-1155 tokens

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

The test suite covers 108 scenarios across all four contracts:

```bash
npm test
```

Tests are organized by contract and use shared fixtures for realistic integration testing. Each test verifies both the happy path and error conditions, including event emissions.

| Contract | Tests | Coverage Focus |
|----------|-------|----------------|
| Access Manager | 18 | Role management, target configuration, integration |
| Assets Registry | 31 | Minting, burning, pausing, enumeration |
| MultiSig | 23 | Signer management, signature validation, token receiving |
| RWA Token | 36 | Allowlist, freezing, voting, permits |

---

## Deployment

### Recommended Order

1. **Deploy MultiSig** — This becomes your governance wallet
2. **Deploy Access Manager** — Pass the MultiSig address as owner
3. **Deploy Registry & Token** — Pass the Access Manager address as authority
4. **Configure Roles** — Grant minting/admin roles through the Access Manager

### Using Hardhat Ignition

```bash
# Set environment variables
export MULTISIG_SIGNERS="0xAddr1,0xAddr2,0xAddr3"
export MULTISIG_THRESHOLD=2
export AUTHORITY=0xAccessManagerAddress

# Deploy to a network
npx hardhat ignition deploy ignition/modules/AroMediaIncMultiSig.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaAccessManager.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaAssetsRegistry.ts --network base-sepolia
npx hardhat ignition deploy ignition/modules/AroMediaRWA.ts --network base-sepolia
```

### Verification

```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Deployed addresses are saved in `ignition/deployments/<network>/deployed_addresses.json`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Deployer wallet private key |
| `MULTISIG_SIGNERS` | Yes | Comma-separated signer addresses |
| `MULTISIG_THRESHOLD` | Yes | Required signatures (e.g., `2`) |
| `AUTHORITY` | Yes | Access Manager address (for managed contracts) |
| `BASE_SEPOLIA_RPC_URL` | For deployment | RPC endpoint |
| `BASESCAN_API_KEY` | For verification | Block explorer API key |

See `.env.example` for a complete template.

---

## Documentation

### Contract Reference

<details>
<summary><strong>AroMediaAccessManager</strong></summary>

The permission layer for all protocol contracts.

| Function | Who Can Call | What It Does |
|----------|--------------|--------------|
| `grantRole(roleId, account, delay)` | Admin | Give an address a role |
| `revokeRole(roleId, account)` | Admin | Remove a role from an address |
| `setTargetFunctionRole(target, selectors, roleId)` | Admin | Assign a role requirement to functions |
| `setTargetClosed(target, closed)` | Admin | Emergency: block all calls to a contract |
| `transferOwnership(newOwner)` | Owner | Change the owner (typically MultiSig) |

</details>

<details>
<summary><strong>AroMediaAssetsRegistry</strong></summary>

ERC-721 NFTs representing real-world assets.

| Function | Who Can Call | What It Does |
|----------|--------------|--------------|
| `safeMint(to, uri)` | Authorized role | Create a new asset NFT |
| `burn(tokenId)` | Token owner | Destroy an NFT |
| `pause()` / `unpause()` | Authorized role | Emergency transfer control |
| `tokenURI(tokenId)` | Anyone | Get metadata location |

Base URI: `https://aro.media/asset-registry/`

</details>

<details>
<summary><strong>AroMediaRWA</strong></summary>

ERC-20 security token with compliance features.

| Function | Who Can Call | What It Does |
|----------|--------------|--------------|
| `mint(to, amount)` | Authorized role | Create new tokens |
| `allowUser(user)` | Authorized role | Add to transfer allowlist |
| `disallowUser(user)` | Authorized role | Remove from allowlist |
| `freeze(user, amount)` | Authorized role | Lock tokens in a wallet |
| `delegate(delegatee)` | Token holder | Assign voting power |
| `permit(...)` | Anyone (with valid sig) | Gasless approval |

</details>

<details>
<summary><strong>AroMediaIncMultiSig</strong></summary>

Smart contract wallet for governance.

| Function | Who Can Call | What It Does |
|----------|--------------|--------------|
| `addSigners(signers)` | Self/EntryPoint | Add authorized signers |
| `removeSigners(signers)` | Self/EntryPoint | Remove signers |
| `setThreshold(n)` | Self/EntryPoint | Change required signatures |
| `isValidSignature(hash, sig)` | Anyone | ERC-1271 signature check |

Supports receiving ETH, ERC-20, ERC-721, and ERC-1155.

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

You may use this code for non-production purposes. For commercial/production use, please contact us for licensing.

---

<div align="center">

**Built by [Aro Media Dev Lab](https://aro.media)**

</div>
