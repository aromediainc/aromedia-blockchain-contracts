/**
 * @file deploy-all.ts
 * @description Deploys all AroMedia contracts in the correct order using Hardhat Ignition.
 *
 * Deployment Order:
 * 1. AroMediaIncMultiSig - Smart Contract Wallet (requires MULTISIG_SIGNERS and MULTISIG_THRESHOLD env vars)
 * 2. AroMediaAccessManager - Access control (uses MultiSig as initial authority)
 * 3. AroMediaRWA - Security Token (uses AccessManager)
 * 4. AroMediaAssetsRegistry - Asset Registry (uses AccessManager)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-all.ts --network <network>
 *
 * Required Environment Variables:
 *   - WALLET_KEY: Deployer private key
 *   - MULTISIG_SIGNERS: Comma-separated list of signer addresses
 *   - MULTISIG_THRESHOLD: Number of required signatures
 */

import * as path from "path";

import { execSync } from "child_process";

interface DeploymentModule {
  name: string;
  modulePath: string;
  description: string;
  envCheck?: () => void;
}

// Deployment order - dependencies must be deployed first
const DEPLOYMENT_ORDER: DeploymentModule[] = [
  {
    name: "AroMediaIncMultiSig",
    modulePath: "ignition/modules/AroMediaIncMultiSig.ts",
    description: "Multi-Signature Smart Contract Wallet",
    envCheck: () => {
      if (!process.env.MULTISIG_SIGNERS) {
        throw new Error(
          "MULTISIG_SIGNERS environment variable is required.\n" +
          "Example: export MULTISIG_SIGNERS=0x1234...,0x5678...,0x9abc..."
        );
      }
      if (!process.env.MULTISIG_THRESHOLD) {
        throw new Error(
          "MULTISIG_THRESHOLD environment variable is required.\n" +
          "Example: export MULTISIG_THRESHOLD=2"
        );
      }
    },
  },
  {
    name: "AroMediaAccessManager",
    modulePath: "ignition/modules/AroMediaAccessManager.ts",
    description: "Access Control Manager",
  },
  {
    name: "AroMediaRWA",
    modulePath: "ignition/modules/AroMediaRWA.ts",
    description: "RWA Security Token",
  },
  {
    name: "AroMediaAssetsRegistry",
    modulePath: "ignition/modules/AroMediaAssetsRegistry.ts",
    description: "Assets Registry",
  },
];

async function main() {
  const network = process.env.HARDHAT_NETWORK || "hardhat";

  console.log("\n" + "=".repeat(60));
  console.log("AroMedia Blockchain Contracts - Full Deployment");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("=".repeat(60) + "\n");

  // Pre-deployment environment checks
  console.log("🔍 Running pre-deployment checks...\n");
  for (const module of DEPLOYMENT_ORDER) {
    if (module.envCheck) {
      try {
        module.envCheck();
        console.log(`  ✓ ${module.name}: Environment variables OK`);
      } catch (error: any) {
        console.error(`  ✗ ${module.name}: ${error.message}`);
        process.exit(1);
      }
    }
  }
  console.log("\n");

  // Deploy each module in order
  const deployedContracts: Record<string, string> = {};

  for (let i = 0; i < DEPLOYMENT_ORDER.length; i++) {
    const module = DEPLOYMENT_ORDER[i];
    const step = i + 1;
    const total = DEPLOYMENT_ORDER.length;

    console.log("-".repeat(60));
    console.log(`[${step}/${total}] Deploying ${module.name}`);
    console.log(`Description: ${module.description}`);
    console.log("-".repeat(60) + "\n");

    try {
      const command = `npx hardhat ignition deploy ${module.modulePath} --network ${network}`;
      console.log(`$ ${command}\n`);

      execSync(command, {
        stdio: "inherit",
        cwd: path.resolve(__dirname, ".."),
      });

      console.log(`\n✅ ${module.name} deployed successfully!\n`);
    } catch (error: any) {
      console.error(`\n❌ Failed to deploy ${module.name}`);
      console.error(error.message);
      process.exit(1);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Deployment Complete!");
  console.log("=".repeat(60));
  console.log("\nNext Steps:");
  console.log("  1. Run verification: npx hardhat run scripts/verify-all.ts --network " + network);
  console.log("  2. Configure roles in AccessManager");
  console.log("  3. Set up token parameters");
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
