import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AroMediaAccessManager, AroMediaAssetsRegistry } from "../typechain-types";

describe("AroMediaAssetsRegistry", function () {
  // Shared fixture for integration testing
  async function deployAssetsRegistryFixture() {
    const [deployer, admin, minter, user1, user2] = await ethers.getSigners();

    // Deploy AccessManager with admin as authority
    const AroMediaAccessManager = await ethers.getContractFactory("AroMediaAccessManager");
    const accessManager = await AroMediaAccessManager.deploy(admin.address);
    await accessManager.waitForDeployment();

    const accessManagerAddr = await accessManager.getAddress();

    // Deploy AssetsRegistry with AccessManager as authority
    const AroMediaAssetsRegistry = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const assetsRegistry = await AroMediaAssetsRegistry.deploy(accessManagerAddr);
    await assetsRegistry.waitForDeployment();

    const registryAddr = await assetsRegistry.getAddress();

    // Configure roles: Set up MINTER_ROLE for restricted functions
    const MINTER_ROLE = 1n;
    const safeMintSelector = assetsRegistry.interface.getFunction("safeMint").selector;
    const pauseSelector = assetsRegistry.interface.getFunction("pause").selector;
    const unpauseSelector = assetsRegistry.interface.getFunction("unpause").selector;

    await accessManager.connect(admin).setTargetFunctionRole(
      registryAddr,
      [safeMintSelector, pauseSelector, unpauseSelector],
      MINTER_ROLE
    );

    // Grant MINTER_ROLE to minter
    await accessManager.connect(admin).grantRole(MINTER_ROLE, minter.address, 0);

    return { accessManager, assetsRegistry, deployer, admin, minter, user1, user2, MINTER_ROLE };
  }

  describe("Deployment", function () {
    it("Should deploy with correct token name and symbol", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      expect(await assetsRegistry.name()).to.equal("AroMediaAssetsRegistry");
      expect(await assetsRegistry.symbol()).to.equal("AROASSETS");
    });

    it("Should have initial supply of zero tokens", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      expect(await assetsRegistry.totalSupply()).to.equal(0);
    });

    it("Should support ERC721 interface", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      // ERC721 interface ID
      const erc721InterfaceId = "0x80ac58cd";
      expect(await assetsRegistry.supportsInterface(erc721InterfaceId)).to.be.true;
    });

    it("Should support ERC721Enumerable interface", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      // ERC721Enumerable interface ID
      const erc721EnumerableInterfaceId = "0x780e9d63";
      expect(await assetsRegistry.supportsInterface(erc721EnumerableInterfaceId)).to.be.true;
    });

    it("Should support ERC721Metadata interface", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      // ERC721Metadata interface ID
      const erc721MetadataInterfaceId = "0x5b5e139f";
      expect(await assetsRegistry.supportsInterface(erc721MetadataInterfaceId)).to.be.true;
    });

    it("Should have a valid contract address", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      const address = await assetsRegistry.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("safeMint", function () {
    it("Should allow authorized minter to mint tokens", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      const tokenURI = "metadata/asset-001.json";

      await expect(assetsRegistry.connect(minter).safeMint(user1.address, tokenURI))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, 0n);

      expect(await assetsRegistry.ownerOf(0)).to.equal(user1.address);
      expect(await assetsRegistry.totalSupply()).to.equal(1);
    });

    it("Should return the correct token ID when minting", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint first token
      const tx1 = await assetsRegistry.connect(minter).safeMint(user1.address, "uri-1");
      const receipt1 = await tx1.wait();
      
      // Check first token ID is 0
      expect(await assetsRegistry.ownerOf(0)).to.equal(user1.address);

      // Mint second token
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-2");
      
      // Check second token ID is 1
      expect(await assetsRegistry.ownerOf(1)).to.equal(user1.address);
      expect(await assetsRegistry.totalSupply()).to.equal(2);
    });

    it("Should revert when unauthorized user tries to mint", async function () {
      const { assetsRegistry, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      await expect(
        assetsRegistry.connect(user1).safeMint(user2.address, "unauthorized-mint")
      ).to.be.revertedWithCustomError(assetsRegistry, "AccessManagedUnauthorized");
    });

    it("Should revert when minting to zero address", async function () {
      const { assetsRegistry, minter } = await loadFixture(deployAssetsRegistryFixture);

      await expect(
        assetsRegistry.connect(minter).safeMint(ethers.ZeroAddress, "zero-addr-mint")
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721InvalidReceiver");
    });
  });

  describe("Token URI", function () {
    it("Should return correct token URI with base URI concatenation", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      const tokenURI = "asset-001.json";
      await assetsRegistry.connect(minter).safeMint(user1.address, tokenURI);

      // Base URI is "https://aro.media/asset-registry/"
      const expectedURI = "https://aro.media/asset-registry/" + tokenURI;
      expect(await assetsRegistry.tokenURI(0)).to.equal(expectedURI);
    });

    it("Should revert when querying URI of non-existent token", async function () {
      const { assetsRegistry } = await loadFixture(deployAssetsRegistryFixture);

      await expect(
        assetsRegistry.tokenURI(999)
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721NonexistentToken");
    });

    it("Should handle empty token URI correctly", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      await assetsRegistry.connect(minter).safeMint(user1.address, "");

      // When URI is empty, it returns base URI + tokenId
      expect(await assetsRegistry.tokenURI(0)).to.equal("https://aro.media/asset-registry/0");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow authorized user to pause the contract", async function () {
      const { assetsRegistry, minter } = await loadFixture(deployAssetsRegistryFixture);

      await expect(assetsRegistry.connect(minter).pause())
        .to.emit(assetsRegistry, "Paused")
        .withArgs(minter.address);

      expect(await assetsRegistry.paused()).to.be.true;
    });

    it("Should allow authorized user to unpause the contract", async function () {
      const { assetsRegistry, minter } = await loadFixture(deployAssetsRegistryFixture);

      // Pause first
      await assetsRegistry.connect(minter).pause();
      expect(await assetsRegistry.paused()).to.be.true;

      // Unpause
      await expect(assetsRegistry.connect(minter).unpause())
        .to.emit(assetsRegistry, "Unpaused")
        .withArgs(minter.address);

      expect(await assetsRegistry.paused()).to.be.false;
    });

    it("Should revert when unauthorized user tries to pause", async function () {
      const { assetsRegistry, user1 } = await loadFixture(deployAssetsRegistryFixture);

      await expect(
        assetsRegistry.connect(user1).pause()
      ).to.be.revertedWithCustomError(assetsRegistry, "AccessManagedUnauthorized");
    });

    it("Should revert when unauthorized user tries to unpause", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Pause with authorized user
      await assetsRegistry.connect(minter).pause();

      // Try to unpause with unauthorized user
      await expect(
        assetsRegistry.connect(user1).unpause()
      ).to.be.revertedWithCustomError(assetsRegistry, "AccessManagedUnauthorized");
    });

    it("Should block transfers when paused", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint a token
      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      // Pause the contract
      await assetsRegistry.connect(minter).pause();

      // Try to transfer - should fail
      await expect(
        assetsRegistry.connect(user1).transferFrom(user1.address, user2.address, 0)
      ).to.be.revertedWithCustomError(assetsRegistry, "EnforcedPause");
    });

    it("Should block minting when paused", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Pause the contract
      await assetsRegistry.connect(minter).pause();

      // Try to mint - should fail
      await expect(
        assetsRegistry.connect(minter).safeMint(user1.address, "test-uri")
      ).to.be.revertedWithCustomError(assetsRegistry, "EnforcedPause");
    });

    it("Should allow transfers after unpause", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint a token
      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      // Pause and then unpause
      await assetsRegistry.connect(minter).pause();
      await assetsRegistry.connect(minter).unpause();

      // Transfer should work now
      await expect(assetsRegistry.connect(user1).transferFrom(user1.address, user2.address, 0))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(user1.address, user2.address, 0n);

      expect(await assetsRegistry.ownerOf(0)).to.equal(user2.address);
    });
  });

  describe("Burn", function () {
    it("Should allow token owner to burn their token", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint a token
      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");
      expect(await assetsRegistry.totalSupply()).to.equal(1);

      // Burn the token
      await expect(assetsRegistry.connect(user1).burn(0))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, 0n);

      expect(await assetsRegistry.totalSupply()).to.equal(0);
    });

    it("Should revert when non-owner tries to burn", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint a token to user1
      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      // user2 tries to burn user1's token
      await expect(
        assetsRegistry.connect(user2).burn(0)
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721InsufficientApproval");
    });

    it("Should allow approved operator to burn token", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint a token to user1
      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      // user1 approves user2
      await assetsRegistry.connect(user1).approve(user2.address, 0);

      // user2 can now burn the token
      await expect(assetsRegistry.connect(user2).burn(0))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, 0n);
    });

    it("Should revert when burning non-existent token", async function () {
      const { assetsRegistry, user1 } = await loadFixture(deployAssetsRegistryFixture);

      await expect(
        assetsRegistry.connect(user1).burn(999)
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721NonexistentToken");
    });
  });

  describe("Transfers", function () {
    it("Should allow token owner to transfer their token", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      await expect(assetsRegistry.connect(user1).transferFrom(user1.address, user2.address, 0))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(user1.address, user2.address, 0n);

      expect(await assetsRegistry.ownerOf(0)).to.equal(user2.address);
    });

    it("Should emit Approval event on approve", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      await expect(assetsRegistry.connect(user1).approve(user2.address, 0))
        .to.emit(assetsRegistry, "Approval")
        .withArgs(user1.address, user2.address, 0n);
    });

    it("Should emit ApprovalForAll event on setApprovalForAll", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      await assetsRegistry.connect(minter).safeMint(user1.address, "test-uri");

      await expect(assetsRegistry.connect(user1).setApprovalForAll(user2.address, true))
        .to.emit(assetsRegistry, "ApprovalForAll")
        .withArgs(user1.address, user2.address, true);
    });
  });

  describe("Enumerable Functions", function () {
    it("Should return correct token by index", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint multiple tokens
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-0");
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-1");
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-2");

      expect(await assetsRegistry.tokenByIndex(0)).to.equal(0);
      expect(await assetsRegistry.tokenByIndex(1)).to.equal(1);
      expect(await assetsRegistry.tokenByIndex(2)).to.equal(2);
    });

    it("Should return correct token of owner by index", async function () {
      const { assetsRegistry, minter, user1, user2 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint tokens to different users
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-0");
      await assetsRegistry.connect(minter).safeMint(user2.address, "uri-1");
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-2");

      // user1 has tokens 0 and 2
      expect(await assetsRegistry.balanceOf(user1.address)).to.equal(2);
      expect(await assetsRegistry.tokenOfOwnerByIndex(user1.address, 0)).to.equal(0);
      expect(await assetsRegistry.tokenOfOwnerByIndex(user1.address, 1)).to.equal(2);

      // user2 has token 1
      expect(await assetsRegistry.balanceOf(user2.address)).to.equal(1);
      expect(await assetsRegistry.tokenOfOwnerByIndex(user2.address, 0)).to.equal(1);
    });

    it("Should revert when querying out of bounds index", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-0");

      await expect(
        assetsRegistry.tokenByIndex(999)
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721OutOfBoundsIndex");

      await expect(
        assetsRegistry.tokenOfOwnerByIndex(user1.address, 999)
      ).to.be.revertedWithCustomError(assetsRegistry, "ERC721OutOfBoundsIndex");
    });

    it("Should update enumerable state after burn", async function () {
      const { assetsRegistry, minter, user1 } = await loadFixture(deployAssetsRegistryFixture);

      // Mint tokens
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-0");
      await assetsRegistry.connect(minter).safeMint(user1.address, "uri-1");
      
      expect(await assetsRegistry.totalSupply()).to.equal(2);

      // Burn first token
      await assetsRegistry.connect(user1).burn(0);
      
      expect(await assetsRegistry.totalSupply()).to.equal(1);
      expect(await assetsRegistry.balanceOf(user1.address)).to.equal(1);
      expect(await assetsRegistry.tokenOfOwnerByIndex(user1.address, 0)).to.equal(1);
    });
  });
});
