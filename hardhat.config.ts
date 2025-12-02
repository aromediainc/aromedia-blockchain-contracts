import "@nomicfoundation/hardhat-toolbox";

import { HardhatUserConfig } from "hardhat/config";

require('dotenv').config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      evmVersion: 'cancun',
      optimizer: {
        enabled: true,
      },
    },
  },
  networks: {
    // Ethereum mainnet
    'mainnet': {
      url: 'https://mainnet.infura.io/v3/' + (process.env.INFURA_API_KEY || ''),
      accounts: [process.env.WALLET_KEY as string],
    },
    // Ethereum Sepolia testnet
    'sepolia': {
      url: 'https://sepolia.infura.io/v3/' + (process.env.INFURA_API_KEY || ''),
      accounts: [process.env.WALLET_KEY as string],
    },
    // Base mainnet
    'base-mainnet': {
      url: 'https://mainnet.base.org',
      accounts: [process.env.WALLET_KEY as string],
      gasPrice: 1000000000,
    },
    // Base testnet
    'base-sepolia': {
      url: 'https://sepolia.base.org',
      accounts: [process.env.WALLET_KEY as string],
      gasPrice: 1000000000,
    },
    // for local dev environment
    'base-local': {
      url: 'http://localhost:8545',
      accounts: [process.env.WALLET_KEY as string],
      gasPrice: 1000000000,
    },
  },
  defaultNetwork: 'hardhat',
  etherscan: {
    apiKey: {
     "mainnet": process.env.ETHERSCAN_API_KEY as string,
     "sepolia": process.env.ETHERSCAN_API_KEY as string,
     "base-sepolia": process.env.ETHERSCAN_API_KEY as string
    },
    customChains: [
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
         apiURL: "https://api-sepolia.basescan.org/api",
         browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
};

export default config;
