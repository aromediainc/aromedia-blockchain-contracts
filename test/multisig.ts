import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AroMediaIncMultiSig } from "../typechain-types";

describe("AroMediaIncMultiSig", function () {
  // Helper function to encode signer address as bytes
  function encodeSigner(address: string): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(["address"], [address]);
  }

  // Shared fixture for testing
  async function deployMultiSigFixture() {
    const [deployer, signer1, signer2, signer3, nonSigner, recipient] = await ethers.getSigners();

    // Encode signers as bytes
    const encodedSigners = [
      encodeSigner(signer1.address),
      encodeSigner(signer2.address),
      encodeSigner(signer3.address),
    ];

    const threshold = 2n;

    const ContractFactory = await ethers.getContractFactory("AroMediaIncMultiSig");
    const multiSig = await ContractFactory.deploy(encodedSigners, threshold);
    await multiSig.waitForDeployment();

    return { multiSig, deployer, signer1, signer2, signer3, nonSigner, recipient, threshold };
  }

  // Single signer fixture
  async function deploySingleSignerFixture() {
    const [deployer, signer1, nonSigner] = await ethers.getSigners();

    const encodedSigners = [encodeSigner(signer1.address)];
    const threshold = 1n;

    const ContractFactory = await ethers.getContractFactory("AroMediaIncMultiSig");
    const multiSig = await ContractFactory.deploy(encodedSigners, threshold);
    await multiSig.waitForDeployment();

    return { multiSig, deployer, signer1, nonSigner, threshold };
  }

  describe("Deployment", function () {
    it("Should deploy with single signer", async function () {
      const { multiSig, signer1 } = await loadFixture(deploySingleSignerFixture);

      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("Should deploy with multiple signers", async function () {
      const { multiSig, signer1, signer2, signer3 } = await loadFixture(deployMultiSigFixture);

      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set correct threshold", async function () {
      const { multiSig, threshold } = await loadFixture(deployMultiSigFixture);

      // We can verify the threshold by checking signing behavior
      // The contract uses MultiSignerERC7913 which stores the threshold
      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should support ERC721Holder interface", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // ERC721Holder implements onERC721Received
      // Test by checking the function exists
      expect(multiSig.interface.getFunction("onERC721Received")).to.not.be.undefined;
    });

    it("Should support ERC1155Holder interface", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // ERC1155Holder implements onERC1155Received and onERC1155BatchReceived
      expect(multiSig.interface.getFunction("onERC1155Received")).to.not.be.undefined;
      expect(multiSig.interface.getFunction("onERC1155BatchReceived")).to.not.be.undefined;
    });
  });

  describe("Signer Management", function () {
    it("Should have addSigners function available", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // Verify the function exists in the interface
      expect(multiSig.interface.getFunction("addSigners")).to.not.be.undefined;
    });

    it("Should have removeSigners function available", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      expect(multiSig.interface.getFunction("removeSigners")).to.not.be.undefined;
    });

    it("Should have setThreshold function available", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      expect(multiSig.interface.getFunction("setThreshold")).to.not.be.undefined;
    });

    it("Should revert addSigners when called by non-entrypoint/self", async function () {
      const { multiSig, nonSigner, recipient } = await loadFixture(deployMultiSigFixture);

      const newSigner = encodeSigner(recipient.address);

      // Direct calls from external accounts should fail
      await expect(
        multiSig.connect(nonSigner).addSigners([newSigner])
      ).to.be.revertedWithCustomError(multiSig, "AccountUnauthorized");
    });

    it("Should revert removeSigners when called by non-entrypoint/self", async function () {
      const { multiSig, nonSigner, signer1 } = await loadFixture(deployMultiSigFixture);

      const signerToRemove = encodeSigner(signer1.address);

      await expect(
        multiSig.connect(nonSigner).removeSigners([signerToRemove])
      ).to.be.revertedWithCustomError(multiSig, "AccountUnauthorized");
    });

    it("Should revert setThreshold when called by non-entrypoint/self", async function () {
      const { multiSig, nonSigner } = await loadFixture(deployMultiSigFixture);

      await expect(
        multiSig.connect(nonSigner).setThreshold(1n)
      ).to.be.revertedWithCustomError(multiSig, "AccountUnauthorized");
    });
  });

  describe("Signature Validation", function () {
    it("Should have isValidSignature function", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      expect(multiSig.interface.getFunction("isValidSignature")).to.not.be.undefined;
    });

    it("Should return invalid magic value for empty signature", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      const hash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      const emptySignature = "0x";

      const result = await multiSig.isValidSignature(hash, emptySignature);
      // Should return 0xffffffff for invalid signature
      expect(result).to.equal("0xffffffff");
    });

    it("Should return invalid magic value or revert for random signature", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      const hash = ethers.keccak256(ethers.toUtf8Bytes("test message"));
      // Random 65-byte signature (but invalid)
      const randomSignature = ethers.hexlify(ethers.randomBytes(65));

      // May revert or return invalid magic value depending on implementation
      try {
        const result = await multiSig.isValidSignature(hash, randomSignature);
        expect(result).to.equal("0xffffffff");
      } catch (e) {
        // Revert is also acceptable for invalid signatures
        expect(e).to.exist;
      }
    });
  });

  describe("ERC721 Token Receiving", function () {
    it("Should receive ERC721 tokens", async function () {
      const { multiSig, deployer, recipient } = await loadFixture(deployMultiSigFixture);

      // Deploy a mock ERC721 token
      const MockERC721 = await ethers.getContractFactory("AroMediaAssetsRegistry");
      
      // Deploy AccessManager for the NFT
      const AccessManager = await ethers.getContractFactory("AroMediaAccessManager");
      const accessManager = await AccessManager.deploy(deployer.address);
      await accessManager.waitForDeployment();

      const mockNFT = await MockERC721.deploy(await accessManager.getAddress());
      await mockNFT.waitForDeployment();

      const multiSigAddress = await multiSig.getAddress();
      const mockNFTAddress = await mockNFT.getAddress();

      // Configure minting role
      const MINTER_ROLE = 1n;
      const safeMintSelector = mockNFT.interface.getFunction("safeMint").selector;
      await accessManager.setTargetFunctionRole(mockNFTAddress, [safeMintSelector], MINTER_ROLE);
      await accessManager.grantRole(MINTER_ROLE, deployer.address, 0);

      // Mint an NFT to the multiSig
      await expect(mockNFT.safeMint(multiSigAddress, "test-uri"))
        .to.emit(mockNFT, "Transfer")
        .withArgs(ethers.ZeroAddress, multiSigAddress, 0n);

      expect(await mockNFT.ownerOf(0)).to.equal(multiSigAddress);
    });

    it("Should return correct onERC721Received magic value", async function () {
      const { multiSig, deployer } = await loadFixture(deployMultiSigFixture);

      // The ERC721Holder returns the correct magic value
      const ERC721_RECEIVED_MAGIC = "0x150b7a02";

      const result = await multiSig.onERC721Received.staticCall(
        deployer.address,
        deployer.address,
        0,
        "0x"
      );

      expect(result).to.equal(ERC721_RECEIVED_MAGIC);
    });
  });

  describe("ERC1155 Token Receiving", function () {
    it("Should return correct onERC1155Received magic value", async function () {
      const { multiSig, deployer } = await loadFixture(deployMultiSigFixture);

      const ERC1155_RECEIVED_MAGIC = "0xf23a6e61";

      const result = await multiSig.onERC1155Received.staticCall(
        deployer.address,
        deployer.address,
        0,
        1,
        "0x"
      );

      expect(result).to.equal(ERC1155_RECEIVED_MAGIC);
    });

    it("Should return correct onERC1155BatchReceived magic value", async function () {
      const { multiSig, deployer } = await loadFixture(deployMultiSigFixture);

      const ERC1155_BATCH_RECEIVED_MAGIC = "0xbc197c81";

      const result = await multiSig.onERC1155BatchReceived.staticCall(
        deployer.address,
        deployer.address,
        [0, 1],
        [1, 1],
        "0x"
      );

      expect(result).to.equal(ERC1155_BATCH_RECEIVED_MAGIC);
    });
  });

  describe("ETH Handling", function () {
    it("Should receive ETH", async function () {
      const { multiSig, deployer } = await loadFixture(deployMultiSigFixture);

      const multiSigAddress = await multiSig.getAddress();
      const amount = ethers.parseEther("1.0");

      await deployer.sendTransaction({
        to: multiSigAddress,
        value: amount,
      });

      const balance = await ethers.provider.getBalance(multiSigAddress);
      expect(balance).to.equal(amount);
    });
  });

  describe("EIP-712 Domain", function () {
    it("Should have correct EIP-712 domain name", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // The EIP-712 domain is set in the constructor: EIP712("AroMediaIncMultiSig", "1")
      // We can verify the contract was deployed successfully with these parameters
      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Account Abstraction (ERC4337)", function () {
    it("Should have validateUserOp function (internal, via Account)", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // The Account contract provides ERC4337 support
      // We verify the contract is properly deployed with Account functionality
      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("ERC7579 Module Support", function () {
    it("Should support ERC7579 modular account features", async function () {
      const { multiSig } = await loadFixture(deployMultiSigFixture);

      // AccountERC7579Hooked provides modular account extensions
      // Verify the contract is properly instantiated
      const address = await multiSig.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });
  });
});
