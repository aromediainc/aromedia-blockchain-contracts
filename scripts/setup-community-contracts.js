#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

// Define paths
const libDir = path.join(__dirname, '..', 'lib');
const contractsDir = path.join(libDir, 'openzeppelin-community-contracts');
const zipPath = path.join(libDir, 'temp-download.zip');
const extractPath = libDir;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, (response) => {
      pipeline(response, file)
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Setting up OpenZeppelin Community Contracts...');

    // Ensure lib directory exists
    if (!fs.existsSync(libDir)) {
      fs.mkdirSync(libDir, { recursive: true });
      console.log('✓ Created lib directory');
    }

    // Remove existing directory if it exists
    if (fs.existsSync(contractsDir)) {
      fs.rmSync(contractsDir, { recursive: true, force: true });
      console.log('✓ Removed existing directory');
    }

    // Download the repository as zip using sparse-checkout approach
    console.log('📥 Downloading OpenZeppelin Community Contracts...');
    
    // Use git clone with sparse-checkout to download only contracts folder
    const tempDir = path.join(libDir, 'temp-repo');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Clone with sparse-checkout
    await execAsync(`
      cd "${libDir}" && \
      git clone --filter=blob:none --sparse https://github.com/OpenZeppelin/openzeppelin-community-contracts.git temp-repo && \
      cd temp-repo && \
      git sparse-checkout set contracts && \
      cd ..
    `, { maxBuffer: 10 * 1024 * 1024 });

    // Move the contracts folder
    const tempContractsPath = path.join(tempDir, 'contracts');
    if (!fs.existsSync(tempContractsPath)) {
      throw new Error('Contracts directory not found in downloaded repository');
    }

    fs.renameSync(tempContractsPath, contractsDir);
    
    // Clean up temp repo
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log('✓ Downloaded repository');

    console.log('✅ Successfully set up OpenZeppelin Community Contracts:');
    console.log('   Location:', contractsDir);
    console.log('\nYou can now import contracts like:');
    console.log('   import "lib/openzeppelin-community-contracts/YourContract.sol";');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error setting up contracts:', errorMessage);
    
    // Cleanup on error
    [zipPath, path.join(libDir, 'temp-repo')].forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    
    process.exit(1);
  }
}

main();