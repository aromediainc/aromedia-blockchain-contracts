import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AroMediaIncMultiSigModule", (m) => {
  // Parse signers from environment variable (comma-separated list of Ethereum addresses)
  const signersEnv = process.env.MULTISIG_SIGNERS;
  if (!signersEnv) {
    throw new Error(
      'MULTISIG_SIGNERS environment variable is not set. ' +
      'Please provide a comma-separated list of signer addresses. ' +
      'Example: export MULTISIG_SIGNERS=0x1234...,0x5678...,0x9abc...'
    );
  }

  const signers = signersEnv
    .split(',')
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0);

  if (signers.length === 0) {
    throw new Error('MULTISIG_SIGNERS must contain at least one address');
  }

  // Validate addresses
  signers.forEach((addr, index) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      throw new Error(`Signer at index ${index} "${addr}" is not a valid Ethereum address`);
    }
  });

  // Parse threshold from environment variable
  const thresholdEnv = process.env.MULTISIG_THRESHOLD;
  if (!thresholdEnv) {
    throw new Error(
      'MULTISIG_THRESHOLD environment variable is not set. ' +
      'Please provide the number of required signatures. ' +
      'Example: export MULTISIG_THRESHOLD=2'
    );
  }

  const threshold = BigInt(thresholdEnv);

  // Validate threshold
  if (threshold <= 0n) {
    throw new Error(`MULTISIG_THRESHOLD must be greater than 0, got ${threshold}`);
  }

  if (threshold > BigInt(signers.length)) {
    throw new Error(
      `MULTISIG_THRESHOLD (${threshold}) cannot be greater than ` +
      `the number of signers (${signers.length})`
    );
  }

  // ABI-encode each signer address as bytes for MultiSignerERC7913 constructor
  // The contract expects bytes[] where each element is an ABI-encoded address
  const { ethers } = require("ethers");
  const encodedSigners = signers.map((addr: string) =>
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [addr])
  );

  const aroMediaIncMultiSig = m.contract("AroMediaIncMultiSig", [encodedSigners, threshold]);

  return { aroMediaIncMultiSig };
});
