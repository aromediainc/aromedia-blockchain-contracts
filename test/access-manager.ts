import { AroMediaAccessManager, AroMediaAssetsRegistry, AroMediaRWA } from "../typechain-types";
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AroMediaAccessManager", function () {
  // Shared fixture for integration testing
  async function deployAccessManagerFixture() {
    const [deployer, multiSigOwner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy AccessManager with multiSigOwner as authority
    const AroMediaAccessManager = await ethers.getContractFactory("AroMediaAccessManager");
    const accessManager = await AroMediaAccessManager.deploy(multiSigOwner.address);
    await accessManager.waitForDeployment();

    return { accessManager, deployer, multiSigOwner, addr1, addr2, addr3 };
  }

  // Full integration fixture with managed contracts
  async function deployFullIntegrationFixture() {
    const { accessManager, deployer, multiSigOwner, addr1, addr2, addr3 } = await loadFixture(deployAccessManagerFixture);

    const accessManagerAddr = await accessManager.getAddress();

    // Deploy AssetsRegistry with AccessManager as authority
    const AroMediaAssetsRegistry = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const assetsRegistry = await AroMediaAssetsRegistry.deploy(accessManagerAddr);
    await assetsRegistry.waitForDeployment();

    // Deploy RWA token with AccessManager as authority
    const AroMediaRWA = await ethers.getContractFactory("AroMediaRWA");
    const rwaToken = await AroMediaRWA.deploy(accessManagerAddr);
    await rwaToken.waitForDeployment();

    return { accessManager, assetsRegistry, rwaToken, deployer, multiSigOwner, addr1, addr2, addr3 };
  }

  describe("Deployment", function () {
    it("Should deploy with multiSigOwner as both owner and authority admin", async function () {
      const { accessManager, multiSigOwner } = await loadFixture(deployAccessManagerFixture);
      
      // Check Ownable owner
      expect(await accessManager.owner()).to.equal(multiSigOwner.address);
      
      // Check AccessManager: multiSigOwner should have ADMIN_ROLE (role 0)
      const ADMIN_ROLE = 0n;
      const [isMember, executionDelay] = await accessManager.hasRole(ADMIN_ROLE, multiSigOwner.address);
      expect(isMember).to.be.true;
      expect(executionDelay).to.equal(0n);
    });

    it("Should not grant admin role to deployer", async function () {
      const { accessManager, deployer, multiSigOwner } = await loadFixture(deployAccessManagerFixture);
      
      // Deployer should NOT have admin role (this was the bug we fixed)
      if (deployer.address !== multiSigOwner.address) {
        const ADMIN_ROLE = 0n;
        const [isMember] = await accessManager.hasRole(ADMIN_ROLE, deployer.address);
        expect(isMember).to.be.false;
      }
    });

    it("Should have a valid contract address", async function () {
      const { accessManager } = await loadFixture(deployAccessManagerFixture);
      const address = await accessManager.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      const { accessManager, multiSigOwner, addr1 } = await loadFixture(deployAccessManagerFixture);

      await expect(accessManager.connect(multiSigOwner).transferOwnership(addr1.address))
        .to.emit(accessManager, "OwnershipTransferred")
        .withArgs(multiSigOwner.address, addr1.address);

      expect(await accessManager.owner()).to.equal(addr1.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      const { accessManager, addr1, addr2 } = await loadFixture(deployAccessManagerFixture);

      await expect(
        accessManager.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWithCustomError(accessManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to renounce ownership", async function () {
      const { accessManager, multiSigOwner } = await loadFixture(deployAccessManagerFixture);

      await expect(accessManager.connect(multiSigOwner).renounceOwnership())
        .to.emit(accessManager, "OwnershipTransferred")
        .withArgs(multiSigOwner.address, ethers.ZeroAddress);

      expect(await accessManager.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Role Management", function () {
    it("Should allow admin to grant roles", async function () {
      const { accessManager, multiSigOwner, addr1 } = await loadFixture(deployAccessManagerFixture);

      const MINTER_ROLE = 1n;
      const grantDelay = 0n;

      await expect(accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, grantDelay))
        .to.emit(accessManager, "RoleGranted");

      const [isMember] = await accessManager.hasRole(MINTER_ROLE, addr1.address);
      expect(isMember).to.be.true;
    });

    it("Should allow admin to revoke roles", async function () {
      const { accessManager, multiSigOwner, addr1 } = await loadFixture(deployAccessManagerFixture);

      const MINTER_ROLE = 1n;

      // Grant role first
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0n);
      let [isMember] = await accessManager.hasRole(MINTER_ROLE, addr1.address);
      expect(isMember).to.be.true;

      // Revoke role
      await expect(accessManager.connect(multiSigOwner).revokeRole(MINTER_ROLE, addr1.address))
        .to.emit(accessManager, "RoleRevoked");

      [isMember] = await accessManager.hasRole(MINTER_ROLE, addr1.address);
      expect(isMember).to.be.false;
    });

    it("Should prevent non-admin from granting roles", async function () {
      const { accessManager, addr1, addr2 } = await loadFixture(deployAccessManagerFixture);

      const MINTER_ROLE = 1n;

      await expect(
        accessManager.connect(addr1).grantRole(MINTER_ROLE, addr2.address, 0n)
      ).to.be.revertedWithCustomError(accessManager, "AccessManagerUnauthorizedAccount");
    });

    it("Should allow user to renounce their own role", async function () {
      const { accessManager, multiSigOwner, addr1 } = await loadFixture(deployAccessManagerFixture);

      const MINTER_ROLE = 1n;

      // Grant role
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0n);

      // User renounces their own role
      await expect(accessManager.connect(addr1).renounceRole(MINTER_ROLE, addr1.address))
        .to.emit(accessManager, "RoleRevoked");

      const [isMember] = await accessManager.hasRole(MINTER_ROLE, addr1.address);
      expect(isMember).to.be.false;
    });
  });

  describe("Target Function Configuration", function () {
    it("Should allow admin to set target function roles", async function () {
      const { accessManager, assetsRegistry, multiSigOwner, addr1 } = await loadFixture(deployFullIntegrationFixture);

      const MINTER_ROLE = 1n;
      const registryAddr = await assetsRegistry.getAddress();

      // Get the function selector for safeMint
      const safeMintSelector = assetsRegistry.interface.getFunction("safeMint").selector;

      // Set the role required for safeMint
      await expect(
        accessManager.connect(multiSigOwner).setTargetFunctionRole(registryAddr, [safeMintSelector], MINTER_ROLE)
      ).to.emit(accessManager, "TargetFunctionRoleUpdated");
    });

    it("Should allow admin to close/open target", async function () {
      const { accessManager, assetsRegistry, multiSigOwner } = await loadFixture(deployFullIntegrationFixture);

      const registryAddr = await assetsRegistry.getAddress();

      // Close the target
      await expect(
        accessManager.connect(multiSigOwner).setTargetClosed(registryAddr, true)
      ).to.emit(accessManager, "TargetClosed").withArgs(registryAddr, true);

      expect(await accessManager.isTargetClosed(registryAddr)).to.be.true;

      // Open the target
      await accessManager.connect(multiSigOwner).setTargetClosed(registryAddr, false);
      expect(await accessManager.isTargetClosed(registryAddr)).to.be.false;
    });
  });

  describe("Integration with Managed Contracts", function () {
    it("Should allow authorized caller to execute restricted functions on AssetsRegistry", async function () {
      const { accessManager, assetsRegistry, multiSigOwner, addr1 } = await loadFixture(deployFullIntegrationFixture);

      const MINTER_ROLE = 1n;
      const registryAddr = await assetsRegistry.getAddress();

      // Get function selector
      const safeMintSelector = assetsRegistry.interface.getFunction("safeMint").selector;

      // Configure: Set role for safeMint
      await accessManager.connect(multiSigOwner).setTargetFunctionRole(registryAddr, [safeMintSelector], MINTER_ROLE);

      // Grant minter role to addr1
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0);

      // addr1 should now be able to mint
      await expect(assetsRegistry.connect(addr1).safeMint(addr1.address, "test-uri"))
        .to.emit(assetsRegistry, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0n);
    });

    it("Should block unauthorized caller from restricted functions", async function () {
      const { accessManager, assetsRegistry, multiSigOwner, addr1, addr2 } = await loadFixture(deployFullIntegrationFixture);

      const MINTER_ROLE = 1n;
      const registryAddr = await assetsRegistry.getAddress();

      // Get function selector
      const safeMintSelector = assetsRegistry.interface.getFunction("safeMint").selector;

      // Configure: Set role for safeMint
      await accessManager.connect(multiSigOwner).setTargetFunctionRole(registryAddr, [safeMintSelector], MINTER_ROLE);

      // Grant minter role ONLY to addr1, not addr2
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0);

      // addr2 should NOT be able to mint
      await expect(
        assetsRegistry.connect(addr2).safeMint(addr2.address, "test-uri")
      ).to.be.revertedWithCustomError(assetsRegistry, "AccessManagedUnauthorized");
    });

    it("Should allow authorized caller to execute restricted functions on RWA token", async function () {
      const { accessManager, rwaToken, multiSigOwner, addr1 } = await loadFixture(deployFullIntegrationFixture);

      const MINTER_ROLE = 1n;
      const tokenAddr = await rwaToken.getAddress();

      // Get function selectors
      const mintSelector = rwaToken.interface.getFunction("mint").selector;
      const allowUserSelector = rwaToken.interface.getFunction("allowUser").selector;

      // Configure: Set role for mint and allowUser
      await accessManager.connect(multiSigOwner).setTargetFunctionRole(tokenAddr, [mintSelector, allowUserSelector], MINTER_ROLE);

      // Grant minter role to addr1
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0);

      // Allow addr1 to receive tokens (strict allowlist)
      await rwaToken.connect(addr1).allowUser(addr1.address);

      // addr1 should now be able to mint
      const amount = ethers.parseEther("1000");
      await expect(rwaToken.connect(addr1).mint(addr1.address, amount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, amount);

      expect(await rwaToken.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should block calls when target is closed", async function () {
      const { accessManager, assetsRegistry, multiSigOwner, addr1 } = await loadFixture(deployFullIntegrationFixture);

      const MINTER_ROLE = 1n;
      const registryAddr = await assetsRegistry.getAddress();

      // Configure role
      const safeMintSelector = assetsRegistry.interface.getFunction("safeMint").selector;
      await accessManager.connect(multiSigOwner).setTargetFunctionRole(registryAddr, [safeMintSelector], MINTER_ROLE);
      await accessManager.connect(multiSigOwner).grantRole(MINTER_ROLE, addr1.address, 0);

      // Close the target
      await accessManager.connect(multiSigOwner).setTargetClosed(registryAddr, true);

      // addr1 should NOT be able to mint when target is closed
      await expect(
        assetsRegistry.connect(addr1).safeMint(addr1.address, "test-uri")
      ).to.be.revertedWithCustomError(assetsRegistry, "AccessManagedUnauthorized");
    });
  });

  describe("Scheduled Operations", function () {
    it("Should support role grants with execution delay", async function () {
      const { accessManager, multiSigOwner, addr1 } = await loadFixture(deployAccessManagerFixture);

      const DELAYED_ROLE = 2n;
      const grantDelay = 3600n; // 1 hour delay

      await accessManager.connect(multiSigOwner).grantRole(DELAYED_ROLE, addr1.address, grantDelay);

      // Check role access with delay
      const [isMember, delay] = await accessManager.hasRole(DELAYED_ROLE, addr1.address);
      expect(isMember).to.be.true;
      expect(delay).to.equal(grantDelay);
    });

    it("Should allow setting role grant delay for a role", async function () {
      const { accessManager, multiSigOwner } = await loadFixture(deployAccessManagerFixture);

      const CUSTOM_ROLE = 3n;
      const roleGrantDelay = 7200n; // 2 hours

      await expect(
        accessManager.connect(multiSigOwner).setGrantDelay(CUSTOM_ROLE, roleGrantDelay)
      ).to.emit(accessManager, "RoleGrantDelayChanged");
    });
  });
});
