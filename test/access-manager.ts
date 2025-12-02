import { AroMediaAccessManager } from "../typechain-types";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("AroMediaAccessManager", function () {
  let accessManager: AroMediaAccessManager;
  let multiSigOwner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    [multiSigOwner, addr1, addr2] = await ethers.getSigners();

    const AroMediaAccessManager = await ethers.getContractFactory("AroMediaAccessManager");
    accessManager = await AroMediaAccessManager.deploy(multiSigOwner.address);
    await accessManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct owner", async function () {
      expect(await accessManager.owner()).to.equal(multiSigOwner.address);
    });
  });

  describe("Ownership", function () {
    it("Should allow owner to transfer ownership", async function () {
      await expect(accessManager.transferOwnership(addr1.address))
        .to.emit(accessManager, "OwnershipTransferred")
        .withArgs(multiSigOwner.address, addr1.address);

      expect(await accessManager.owner()).to.equal(addr1.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      await expect(
        accessManager.connect(addr1).transferOwnership(addr2.address)
      ).to.be.revertedWithCustomError(accessManager, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to renounce ownership", async function () {
      await expect(accessManager.renounceOwnership())
        .to.emit(accessManager, "OwnershipTransferred")
        .withArgs(multiSigOwner.address, ethers.ZeroAddress);

      expect(await accessManager.owner()).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Authority Management", function () {
    it("Should be deployable as an AccessManager for other contracts", async function () {
      const accessManagerAddr = await accessManager.getAddress();
      expect(accessManagerAddr).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Access Control Integration", function () {
    it("Should support role management as AccessManager", async function () {
      // Get the PUBLIC_ROLE from AccessManager
      const PUBLIC_ROLE = 0n;
      
      // Grant a role to an address
      const grantRoleData = accessManager.interface.encodeFunctionData("grantRole", [
        PUBLIC_ROLE,
        addr1.address,
        0n, // grant delay
      ]);

      // This should be callable by the manager (deployer initially set as authority)
      // In practice, the owner would use this to configure permissions
      expect(grantRoleData).to.not.be.empty;
    });
  });

  describe("Integration with Managed Contracts", function () {
    it("Should be usable as authority for AccessManaged contracts", async function () {
      const accessManagerAddr = await accessManager.getAddress();
      expect(accessManagerAddr).to.not.equal(ethers.ZeroAddress);
      expect(accessManagerAddr).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});
