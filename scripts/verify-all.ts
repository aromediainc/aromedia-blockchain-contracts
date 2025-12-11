/**
 * @file verify-all.ts
 * @description Verifies all deployed AroMedia contracts by reading from Ignition deployment logs.
 *
 * This script:
 * 1. Reads deployed addresses from Ignition's deployed_addresses.json
 * 2. Extracts constructor arguments from Ignition's journal.jsonl
 * 3. Runs Hardhat verification for each contract
 *
 * Usage:
 *   npx hardhat run scripts/verify-all.ts --network <network>
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

import { execSync } from "child_process";

// Chain ID to network name mapping
const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: "mainnet",
  11155111: "sepolia",
  8453: "base-mainnet",
  84532: "base-sepolia",
};

// Network name to chain ID mapping (reverse)
const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  mainnet: 1,
  sepolia: 11155111,
  "base-mainnet": 8453,
  "base-sepolia": 84532,
};

// Contracts to skip verification (e.g., MultiSig wallets shouldn't be verified on explorers)
const SKIP_VERIFICATION: string[] = [
  "AroMediaIncMultiSig",
];

// Explorer base URLs for each network
const EXPLORER_URLS: Record<string, string> = {
  mainnet: "https://etherscan.io",
  sepolia: "https://sepolia.etherscan.io",
  "base-mainnet": "https://basescan.org",
  "base-sepolia": "https://sepolia.basescan.org",
};

// Contract display names for better readability in logs
const CONTRACT_DISPLAY_NAMES: Record<string, string> = {
  AroMediaIncMultiSig: "AroMediaIncMultiSig (Multi-Signature Wallet)",
  AroMediaAccessManager: "AroMediaAccessManager (Access Control)",
  AroMediaRWA: "AroMediaRWA (Security Token)",
  AroMediaAssetsRegistry: "AroMediaAssetsRegistry (NFT Asset Registry)",
  ForcedTransferManager: "ForcedTransferManager (Regulatory Compliance)",
};

interface DeploymentState {
  artifactId: string;
  contractName: string;
  constructorArgs: any[];
  futureId: string;
}

interface DeployedAddresses {
  [key: string]: string;
}

interface ContractVerification {
  name: string;
  address: string;
  constructorArgs: any[];
}

/**
 * Parse a BigInt JSON representation from Ignition journal
 */
function parseBigIntValue(value: any): any {
  if (value && typeof value === "object" && value._kind === "bigint") {
    return BigInt(value.value);
  }
  if (Array.isArray(value)) {
    return value.map(parseBigIntValue);
  }
  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = parseBigIntValue(v);
    }
    return result;
  }
  return value;
}

/**
 * Read and parse the Ignition journal.jsonl file
 */
async function readJournal(journalPath: string): Promise<DeploymentState[]> {
  const deploymentStates: DeploymentState[] = [];

  if (!fs.existsSync(journalPath)) {
    throw new Error(`Journal file not found: ${journalPath}`);
  }

  const fileStream = fs.createReadStream(journalPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Look for DEPLOYMENT_EXECUTION_STATE_INITIALIZE entries which contain constructor args
      if (entry.type === "DEPLOYMENT_EXECUTION_STATE_INITIALIZE") {
        deploymentStates.push({
          artifactId: entry.artifactId,
          contractName: entry.contractName,
          constructorArgs: parseBigIntValue(entry.constructorArgs),
          futureId: entry.futureId,
        });
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  return deploymentStates;
}

/**
 * Read deployed addresses from Ignition
 */
function readDeployedAddresses(addressesPath: string): DeployedAddresses {
  if (!fs.existsSync(addressesPath)) {
    throw new Error(`Deployed addresses file not found: ${addressesPath}`);
  }

  return JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
}

/**
 * Get the explorer URL for a contract address
 */
function getExplorerUrl(network: string, address: string): string {
  const baseUrl = EXPLORER_URLS[network];
  if (!baseUrl) {
    return `Unknown explorer for network: ${network}`;
  }
  return `${baseUrl}/address/${address}#code`;
}

/**
 * Get display name for a contract
 */
function getDisplayName(contractName: string): string {
  return CONTRACT_DISPLAY_NAMES[contractName] || contractName;
}

/**
 * Generate verification log file
 */
function generateVerificationLog(
  network: string,
  chainId: number,
  results: { name: string; address: string; success: boolean }[],
  skippedContracts: { name: string; address: string; reason: string }[],
  deploymentsDir: string
): string {
  const logDir = path.resolve(__dirname, "..", "verification-logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logFile = path.join(logDir, `verification-${network}-${timestamp}.md`);

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const allContracts = [
    ...skippedContracts.map((s) => ({ name: s.name, address: s.address, status: "skipped" as const })),
    ...results.map((r) => ({ name: r.name, address: r.address, status: r.success ? "verified" as const : "failed" as const })),
  ];

  let content = `# AroMedia Blockchain Contracts - Verification Log\n\n`;
  content += `**Network:** ${network}\n`;
  content += `**Chain ID:** ${chainId}\n`;
  content += `**Timestamp:** ${new Date().toISOString()}\n`;
  content += `**Explorer:** ${EXPLORER_URLS[network] || "Unknown"}\n\n`;
  content += `---\n\n`;
  content += `## Summary\n\n`;
  content += `| Status | Count |\n`;
  content += `|--------|-------|\n`;
  content += `| ✅ Verified | ${successful.length} |\n`;
  content += `| ❌ Failed | ${failed.length} |\n`;
  content += `| ⏭️ Skipped | ${skippedContracts.length} |\n`;
  content += `| **Total** | **${allContracts.length}** |\n\n`;
  content += `---\n\n`;
  content += `## Deployed Contracts\n\n`;

  for (const contract of allContracts) {
    const displayName = getDisplayName(contract.name);
    const explorerUrl = getExplorerUrl(network, contract.address);
    const statusEmoji = contract.status === "verified" ? "✅" : contract.status === "failed" ? "❌" : "⏭️";

    content += `### ${statusEmoji} ${displayName}\n\n`;
    content += `- **Address:** \`${contract.address}\`\n`;
    content += `- **Status:** ${contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}\n`;
    content += `- **Explorer:** ${explorerUrl}\n\n`;
  }

  content += `---\n\n`;
  content += `## Quick Links\n\n`;

  for (const contract of allContracts) {
    const displayName = getDisplayName(contract.name);
    const explorerUrl = getExplorerUrl(network, contract.address);
    content += `- [${displayName}](${explorerUrl})\n`;
  }

  content += `\n---\n\n`;
  content += `*Generated by AroMedia verification script*\n`;

  fs.writeFileSync(logFile, content);
  return logFile;
}

/**
 * Generate constructor arguments file for verification
 */
function generateArgsFile(
  contractName: string,
  args: any[],
  network: string
): string {
  const argsDir = path.resolve(__dirname, "..", "arguments");
  if (!fs.existsSync(argsDir)) {
    fs.mkdirSync(argsDir, { recursive: true });
  }

  const argsFile = path.join(argsDir, `${contractName}-${network}.js`);

  // Convert args to JS-compatible format
  const formattedArgs = args.map((arg) => {
    if (typeof arg === "bigint") {
      return Number(arg);
    }
    return arg;
  });

  const content = `module.exports = ${JSON.stringify(formattedArgs, null, 2).replace(/"(\d+)"/g, "$1")};\n`;

  fs.writeFileSync(argsFile, content);
  return argsFile;
}

/**
 * Verify a single contract
 */
function verifyContract(
  address: string,
  argsFile: string | null,
  network: string
): boolean {
  try {
    let command = `npx hardhat verify --network ${network}`;

    if (argsFile) {
      // Use relative path for cleaner output
      const relativeArgsFile = path.relative(process.cwd(), argsFile);
      command += ` --constructor-args ${relativeArgsFile}`;
    }

    command += ` ${address}`;

    console.log(`$ ${command}\n`);

    execSync(command, {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });

    return true;
  } catch (error: any) {
    // Check if already verified
    if (error.message?.includes("Already Verified") || 
        error.stdout?.includes("Already Verified")) {
      console.log("Contract is already verified.\n");
      return true;
    }
    return false;
  }
}

async function main() {
  const network = process.env.HARDHAT_NETWORK || "hardhat";

  if (network === "hardhat" || network === "localhost") {
    console.log("Verification is not needed for local networks.");
    return;
  }

  const chainId = NETWORK_TO_CHAIN_ID[network];
  if (!chainId) {
    console.error(`Unknown network: ${network}`);
    console.log("Supported networks:", Object.keys(NETWORK_TO_CHAIN_ID).join(", "));
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("AroMedia Blockchain Contracts - Verification");
  console.log("=".repeat(60));
  console.log(`Network: ${network} (Chain ID: ${chainId})`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("=".repeat(60) + "\n");

  // Find deployment directory
  const deploymentsDir = path.resolve(
    __dirname,
    "..",
    "ignition",
    "deployments",
    `chain-${chainId}`
  );

  if (!fs.existsSync(deploymentsDir)) {
    console.error(`No deployments found for chain ${chainId}`);
    console.log(`Expected directory: ${deploymentsDir}`);
    process.exit(1);
  }

  const journalPath = path.join(deploymentsDir, "journal.jsonl");
  const addressesPath = path.join(deploymentsDir, "deployed_addresses.json");

  // Read deployment data
  console.log("📖 Reading deployment data...\n");

  const deploymentStates = await readJournal(journalPath);
  const deployedAddresses = readDeployedAddresses(addressesPath);

  console.log(`Found ${Object.keys(deployedAddresses).length} deployed contract(s)\n`);

  // Build verification list
  const contractsToVerify: ContractVerification[] = [];
  const skippedContracts: { name: string; address: string; reason: string }[] = [];

  for (const [futureId, address] of Object.entries(deployedAddresses)) {
    const state = deploymentStates.find((s) => s.futureId === futureId);

    if (state) {
      // Check if contract should be skipped
      if (SKIP_VERIFICATION.includes(state.contractName)) {
        skippedContracts.push({
          name: state.contractName,
          address,
          reason: "Contract excluded from verification",
        });
        console.log(`⏭️  Skipping ${state.contractName} (excluded from verification)\n`);
        continue;
      }

      contractsToVerify.push({
        name: state.contractName,
        address,
        constructorArgs: state.constructorArgs,
      });
    } else {
      console.warn(`Warning: No deployment state found for ${futureId}`);
    }
  }

  // Verify each contract
  const results: { name: string; address: string; success: boolean }[] = [];

  for (let i = 0; i < contractsToVerify.length; i++) {
    const contract = contractsToVerify[i];
    const step = i + 1;
    const total = contractsToVerify.length;

    console.log("-".repeat(60));
    console.log(`[${step}/${total}] Verifying ${contract.name}`);
    console.log(`Address: ${contract.address}`);
    console.log("-".repeat(60) + "\n");

    let argsFile: string | null = null;

    if (contract.constructorArgs && contract.constructorArgs.length > 0) {
      console.log("Constructor Arguments:", JSON.stringify(contract.constructorArgs, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      , 2));
      console.log("\n");

      argsFile = generateArgsFile(contract.name, contract.constructorArgs, network);
      console.log(`Arguments file: ${argsFile}\n`);
    }

    const success = verifyContract(contract.address, argsFile, network);

    results.push({
      name: contract.name,
      address: contract.address,
      success,
    });

    if (success) {
      console.log(`✅ ${contract.name} verified successfully!\n`);
    } else {
      console.log(`❌ ${contract.name} verification failed.\n`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Verification Summary");
  console.log("=".repeat(60) + "\n");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Skipped: ${skippedContracts.length}\n`);

  if (successful.length > 0) {
    console.log("✅ Verified:");
    for (const r of successful) {
      console.log(`   - ${r.name}: ${r.address}`);
    }
  }

  if (failed.length > 0) {
    console.log("\n❌ Failed:");
    for (const r of failed) {
      console.log(`   - ${r.name}: ${r.address}`);
    }
  }

  if (skippedContracts.length > 0) {
    console.log("\n⏭️  Skipped:");
    for (const s of skippedContracts) {
      console.log(`   - ${s.name}: ${s.address} (${s.reason})`);
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Generate detailed verification log with explorer links
  console.log("📋 Deployed Contracts with Explorer Links:\n");

  // Combine all contracts for display (skipped first, then verified/failed)
  const allContracts = [
    ...skippedContracts.map((s) => ({ name: s.name, address: s.address, status: "skipped" as const })),
    ...results.map((r) => ({ name: r.name, address: r.address, status: r.success ? "verified" as const : "failed" as const })),
  ];

  for (const contract of allContracts) {
    const displayName = getDisplayName(contract.name);
    const explorerUrl = getExplorerUrl(network, contract.address);
    const statusEmoji = contract.status === "verified" ? "✅" : contract.status === "failed" ? "❌" : "⏭️";

    console.log(`${statusEmoji} ${displayName}`);
    console.log(`   ${explorerUrl}\n`);
  }

  // Save verification log to file
  const logFile = generateVerificationLog(network, chainId, results, skippedContracts, deploymentsDir);
  console.log("\n" + "=".repeat(60));
  console.log(`📄 Verification log saved to: ${logFile}`);
  console.log("=".repeat(60) + "\n");

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
