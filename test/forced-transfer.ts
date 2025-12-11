import { AroMediaAccessManager, AroMediaAssetsRegistry, AroMediaRWA, ForcedTransferManager } from "../typechain-types";

import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ForcedTransferManager", function () {
  // Role constants (must match AroMediaAccessManager)
  const ROLE_ORG_ADMIN = 0n;
  const ROLE_PROTOCOL_ADMIN = 1n;
  const ROLE_TREASURY_CONTROLLER = 2n;
  const ROLE_MINTER = 4n;
  const ROLE_OPERATOR = 7n;
  const ROLE_AUDITOR = 8n;

  // Shared fixture for forced transfer testing
  async function deployForcedTransferFixture() {
    const [deployer, admin, protocolAdmin, treasuryController1, treasuryController2, auditor, operator, minter, user1, user2, user3] = await ethers.getSigners();

    // Deploy AccessManager with admin as authority
    const AroMediaAccessManager = await ethers.getContractFactory("AroMediaAccessManager");
    const accessManager = await AroMediaAccessManager.deploy(admin.address);
    await accessManager.waitForDeployment();
    const accessManagerAddr = await accessManager.getAddress();

    // Deploy Assets Registry
    const AroMediaAssetsRegistry = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const assetsRegistry = await AroMediaAssetsRegistry.deploy(accessManagerAddr);
    await assetsRegistry.waitForDeployment();
    const assetsRegistryAddr = await assetsRegistry.getAddress();

    // Deploy RWA token with AccessManager as authority
    const AroMediaRWA = await ethers.getContractFactory("AroMediaRWA");
    const rwaToken = await AroMediaRWA.deploy(accessManagerAddr);
    await rwaToken.waitForDeployment();
    const tokenAddr = await rwaToken.getAddress();

    // Deploy ForcedTransferManager
    const ForcedTransferManager = await ethers.getContractFactory("ForcedTransferManager");
    const forcedTransferManager = await ForcedTransferManager.deploy(accessManagerAddr);
    await forcedTransferManager.waitForDeployment();
    const forcedTransferManagerAddr = await forcedTransferManager.getAddress();

    // Wire all contracts with the AccessManager
    await accessManager.connect(admin).wireAllContracts(tokenAddr, assetsRegistryAddr, forcedTransferManagerAddr);

    // Grant roles
    await accessManager.connect(admin).grantRole(ROLE_PROTOCOL_ADMIN, protocolAdmin.address, 0);
    await accessManager.connect(admin).grantRole(ROLE_TREASURY_CONTROLLER, treasuryController1.address, 0);
    await accessManager.connect(admin).grantRole(ROLE_TREASURY_CONTROLLER, treasuryController2.address, 0);
    await accessManager.connect(admin).grantRole(ROLE_AUDITOR, auditor.address, 0);
    await accessManager.connect(admin).grantRole(ROLE_OPERATOR, operator.address, 0);
    await accessManager.connect(admin).grantRole(ROLE_MINTER, minter.address, 0);

    // Configure ForcedTransferManager with token and registry
    await forcedTransferManager.connect(admin).configure(tokenAddr, assetsRegistryAddr);

    // Set the ForcedTransferManager on the RWA token (PROTOCOL_ADMIN action)
    await rwaToken.connect(protocolAdmin).setForcedTransferManager(forcedTransferManagerAddr);

    // Allow users on the allowlist
    await rwaToken.connect(operator).allowUser(user1.address);
    await rwaToken.connect(operator).allowUser(user2.address);
    await rwaToken.connect(operator).allowUser(user3.address);

    // Issue some tokens to user1 (source for forced transfer)
    const initialBalance = ethers.parseEther("10000");
    await rwaToken.connect(minter).issue(user1.address, initialBalance);

    return {
      accessManager,
      rwaToken,
      assetsRegistry,
      forcedTransferManager,
      deployer,
      admin, // ORG_ADMIN
      protocolAdmin, // PROTOCOL_ADMIN
      treasuryController1,
      treasuryController2,
      auditor,
      operator,
      minter,
      user1,
      user2,
      user3,
      initialBalance,
    };
  }

  // Helper function to mint a dossier NFT
  async function mintDossier(assetsRegistry: AroMediaAssetsRegistry, minter: any, reason: string): Promise<bigint> {
    const tx = await assetsRegistry.connect(minter).safeMint(minter.address, `dossier-${reason}.json`);
    const receipt = await tx.wait();
    // Get the tokenId from the Transfer event
    const transferEvent = receipt?.logs.find(
      (log: any) => log.fragment?.name === "Transfer"
    );
    if (transferEvent && "args" in transferEvent) {
      return transferEvent.args.tokenId;
    }
    // Fallback: return the next expected tokenId - 1
    return 0n;
  }

  describe("Deployment & Configuration", function () {
    it("Should deploy with correct authority", async function () {
      const { forcedTransferManager, accessManager } = await loadFixture(deployForcedTransferFixture);
      expect(await forcedTransferManager.authority()).to.equal(await accessManager.getAddress());
    });

    it("Should have RWA token and assets registry configured", async function () {
      const { forcedTransferManager, rwaToken, assetsRegistry } = await loadFixture(deployForcedTransferFixture);
      expect(await forcedTransferManager.rwaToken()).to.equal(await rwaToken.getAddress());
      expect(await forcedTransferManager.assetsRegistry()).to.equal(await assetsRegistry.getAddress());
    });

    it("Should emit events when configured", async function () {
      const { accessManager, admin, rwaToken, assetsRegistry } = await loadFixture(deployForcedTransferFixture);
      
      const ForcedTransferManager = await ethers.getContractFactory("ForcedTransferManager");
      const newManager = await ForcedTransferManager.deploy(await accessManager.getAddress());
      await accessManager.connect(admin).wireForcedTransferManager(await newManager.getAddress());

      await expect(newManager.connect(admin).configure(
        await rwaToken.getAddress(),
        await assetsRegistry.getAddress()
      ))
        .to.emit(newManager, "RWATokenSet")
        .and.to.emit(newManager, "AssetsRegistrySet");
    });

    it("Should revert configure if called by non-admin", async function () {
      const { forcedTransferManager, user1, rwaToken, assetsRegistry } = await loadFixture(deployForcedTransferFixture);
      await expect(
        forcedTransferManager.connect(user1).configure(
          await rwaToken.getAddress(),
          await assetsRegistry.getAddress()
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
    });
  });

  describe("Initiation", function () {
    it("Should allow TREASURY_CONTROLLER to initiate forced transfer with valid dossier", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      // Mint a dossier NFT
      const dossierTokenId = await mintDossier(assetsRegistry, minter, "regulatory-action-001");
      
      const amount = ethers.parseEther("1000");
      const reason = "Regulatory compliance action per SEC order #12345";

      await expect(
        forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          amount,
          dossierTokenId,
          reason
        )
      )
        .to.emit(forcedTransferManager, "ForcedTransferInitiated")
        .withArgs(0n, user1.address, user2.address, amount, dossierTokenId, treasuryController1.address, reason);

      // Verify request was created
      const request = await forcedTransferManager.getRequest(0n);
      expect(request.from).to.equal(user1.address);
      expect(request.to).to.equal(user2.address);
      expect(request.amount).to.equal(amount);
      expect(request.dossierTokenId).to.equal(dossierTokenId);
      expect(request.initiator).to.equal(treasuryController1.address);
      expect(request.status).to.equal(0n); // PENDING
    });

    it("Should revert if caller is not TREASURY_CONTROLLER", async function () {
      const { forcedTransferManager, assetsRegistry, minter, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "test");
      
      await expect(
        forcedTransferManager.connect(user1).initiate(
          user1.address,
          user2.address,
          ethers.parseEther("100"),
          dossierTokenId,
          "Unauthorized attempt"
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
    });

    it("Should revert if RWA token is not configured", async function () {
      const { accessManager, treasuryController1, admin, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      // Deploy new manager without configuration
      const ForcedTransferManager = await ethers.getContractFactory("ForcedTransferManager");
      const newManager = await ForcedTransferManager.deploy(await accessManager.getAddress());
      await accessManager.connect(admin).wireForcedTransferManager(await newManager.getAddress());

      await expect(
        newManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          ethers.parseEther("100"),
          0n,
          "Test"
        )
      ).to.be.revertedWithCustomError(newManager, "NotConfigured");
    });

    it("Should revert if dossier NFT does not exist", async function () {
      const { forcedTransferManager, treasuryController1, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      const nonExistentDossierId = 9999n;
      
      await expect(
        forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          ethers.parseEther("100"),
          nonExistentDossierId,
          "Test"
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "DossierNotFound");
    });

    it("Should revert if dossier has already been used", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "reuse-test");
      
      // First initiation succeeds
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        ethers.parseEther("100"),
        dossierTokenId,
        "First use"
      );

      // Second initiation with same dossier should fail
      await expect(
        forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          ethers.parseEther("100"),
          dossierTokenId,
          "Reuse attempt"
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "DossierAlreadyUsed");
    });

    it("Should revert if destination is zero address", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1 } = await loadFixture(deployForcedTransferFixture);

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "zero-dest");
      
      await expect(
        forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          ethers.ZeroAddress,
          ethers.parseEther("100"),
          dossierTokenId,
          "Invalid destination"
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "InvalidAddress");
    });

    it("Should revert if source has insufficient balance", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2, initialBalance } = await loadFixture(deployForcedTransferFixture);

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "insufficient");
      const excessiveAmount = initialBalance + ethers.parseEther("1");
      
      await expect(
        forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          excessiveAmount,
          dossierTokenId,
          "Excessive amount"
        )
      ).to.be.revertedWithCustomError(forcedTransferManager, "InsufficientBalance");
    });

    it("Should mark dossier as used after initiation", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "mark-used");
      
      expect(await forcedTransferManager.isDossierUsed(dossierTokenId)).to.be.false;
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        ethers.parseEther("100"),
        dossierTokenId,
        "Test"
      );

      expect(await forcedTransferManager.isDossierUsed(dossierTokenId)).to.be.true;
    });
  });

  describe("Approvals", function () {
    async function initiatedRequestFixture() {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = fixture;

      // Mint dossier and initiate request
      const dossierTokenId = await mintDossier(assetsRegistry, minter, "approval-test");
      const amount = ethers.parseEther("1000");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        amount,
        dossierTokenId,
        "Compliance action"
      );

      return { ...fixture, dossierTokenId, amount, requestId: 0n };
    }

    describe("Treasury Approval", function () {
      it("Should allow different TREASURY_CONTROLLER to approve", async function () {
        const { forcedTransferManager, treasuryController2, requestId } = await initiatedRequestFixture();

        await expect(forcedTransferManager.connect(treasuryController2).approveTreasury(requestId))
          .to.emit(forcedTransferManager, "ForcedTransferApproval")
          .withArgs(requestId, treasuryController2.address, "TREASURY_CONTROLLER");

        const request = await forcedTransferManager.getRequest(requestId);
        expect(request.treasuryApproval).to.be.true;
      });

      it("Should revert if initiator tries to approve (separation of duties)", async function () {
        const { forcedTransferManager, treasuryController1, requestId } = await initiatedRequestFixture();

        await expect(
          forcedTransferManager.connect(treasuryController1).approveTreasury(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "CannotSelfApprove");
      });

      it("Should revert if already approved by treasury", async function () {
        const { forcedTransferManager, treasuryController2, requestId } = await initiatedRequestFixture();

        await forcedTransferManager.connect(treasuryController2).approveTreasury(requestId);

        await expect(
          forcedTransferManager.connect(treasuryController2).approveTreasury(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "AlreadyApproved");
      });

      it("Should revert if non-TREASURY_CONTROLLER tries to approve", async function () {
        const { forcedTransferManager, auditor, requestId } = await initiatedRequestFixture();

        await expect(
          forcedTransferManager.connect(auditor).approveTreasury(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
      });
    });

    describe("Auditor Approval", function () {
      it("Should allow AUDITOR to approve", async function () {
        const { forcedTransferManager, auditor, requestId } = await initiatedRequestFixture();

        await expect(forcedTransferManager.connect(auditor).approveAuditor(requestId))
          .to.emit(forcedTransferManager, "ForcedTransferApproval")
          .withArgs(requestId, auditor.address, "AUDITOR");

        const request = await forcedTransferManager.getRequest(requestId);
        expect(request.auditorApproval).to.be.true;
      });

      it("Should revert if non-AUDITOR tries to approve", async function () {
        const { forcedTransferManager, treasuryController1, requestId } = await initiatedRequestFixture();

        await expect(
          forcedTransferManager.connect(treasuryController1).approveAuditor(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
      });

      it("Should revert if already approved", async function () {
        const { forcedTransferManager, auditor, requestId } = await initiatedRequestFixture();

        await forcedTransferManager.connect(auditor).approveAuditor(requestId);

        await expect(
          forcedTransferManager.connect(auditor).approveAuditor(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "AlreadyApproved");
      });
    });

    describe("Org Admin Approval", function () {
      it("Should allow ORG_ADMIN to approve", async function () {
        const { forcedTransferManager, admin, requestId } = await initiatedRequestFixture();

        await expect(forcedTransferManager.connect(admin).approveOrgAdmin(requestId))
          .to.emit(forcedTransferManager, "ForcedTransferApproval")
          .withArgs(requestId, admin.address, "ORG_ADMIN");

        const request = await forcedTransferManager.getRequest(requestId);
        expect(request.orgAdminApproval).to.be.true;
      });

      it("Should revert if non-ORG_ADMIN tries to approve", async function () {
        const { forcedTransferManager, auditor, requestId } = await initiatedRequestFixture();

        await expect(
          forcedTransferManager.connect(auditor).approveOrgAdmin(requestId)
        ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
      });
    });

    describe("Full Approval Flow", function () {
      it("Should update status to APPROVED after all three approvals", async function () {
        const { forcedTransferManager, treasuryController2, auditor, admin, requestId } = await initiatedRequestFixture();

        // Initial status is PENDING (0)
        let request = await forcedTransferManager.getRequest(requestId);
        expect(request.status).to.equal(0n);

        // Treasury approval
        await forcedTransferManager.connect(treasuryController2).approveTreasury(requestId);
        request = await forcedTransferManager.getRequest(requestId);
        expect(request.status).to.equal(0n); // Still PENDING

        // Auditor approval
        await forcedTransferManager.connect(auditor).approveAuditor(requestId);
        request = await forcedTransferManager.getRequest(requestId);
        expect(request.status).to.equal(0n); // Still PENDING

        // Org Admin approval (final)
        await forcedTransferManager.connect(admin).approveOrgAdmin(requestId);
        request = await forcedTransferManager.getRequest(requestId);
        expect(request.status).to.equal(1n); // APPROVED

        expect(await forcedTransferManager.isFullyApproved(requestId)).to.be.true;
      });

      it("Should work with approvals in any order", async function () {
        const { forcedTransferManager, treasuryController2, auditor, admin, requestId } = await initiatedRequestFixture();

        // Approve in different order: Admin -> Auditor -> Treasury
        await forcedTransferManager.connect(admin).approveOrgAdmin(requestId);
        await forcedTransferManager.connect(auditor).approveAuditor(requestId);
        await forcedTransferManager.connect(treasuryController2).approveTreasury(requestId);

        const request = await forcedTransferManager.getRequest(requestId);
        expect(request.status).to.equal(1n); // APPROVED
      });
    });
  });

  describe("Execution", function () {
    async function fullyApprovedRequestFixture() {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, treasuryController2, auditor, admin, minter, user1, user2 } = fixture;

      // Mint dossier and initiate request
      const dossierTokenId = await mintDossier(assetsRegistry, minter, "execution-test");
      const amount = ethers.parseEther("1000");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        amount,
        dossierTokenId,
        "Compliance action"
      );

      const requestId = 0n;

      // Approve with all three parties
      await forcedTransferManager.connect(treasuryController2).approveTreasury(requestId);
      await forcedTransferManager.connect(auditor).approveAuditor(requestId);
      await forcedTransferManager.connect(admin).approveOrgAdmin(requestId);

      return { ...fixture, dossierTokenId, amount, requestId };
    }

    it("Should execute fully approved forced transfer", async function () {
      const { forcedTransferManager, rwaToken, treasuryController1, user1, user2, amount, requestId, initialBalance, dossierTokenId } = await fullyApprovedRequestFixture();

      const user1BalanceBefore = await rwaToken.balanceOf(user1.address);
      const user2BalanceBefore = await rwaToken.balanceOf(user2.address);

      await expect(forcedTransferManager.connect(treasuryController1).execute(requestId))
        .to.emit(forcedTransferManager, "ForcedTransferExecuted")
        .withArgs(requestId, user1.address, user2.address, amount, dossierTokenId);

      // Verify balances changed
      expect(await rwaToken.balanceOf(user1.address)).to.equal(user1BalanceBefore - amount);
      expect(await rwaToken.balanceOf(user2.address)).to.equal(user2BalanceBefore + amount);

      // Verify status is EXECUTED
      const request = await forcedTransferManager.getRequest(requestId);
      expect(request.status).to.equal(2n); // EXECUTED
    });

    it("Should revert if not fully approved", async function () {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, treasuryController2, minter, user1, user2 } = fixture;

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "partial-approval");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        ethers.parseEther("100"),
        dossierTokenId,
        "Test"
      );

      // Only treasury approval
      await forcedTransferManager.connect(treasuryController2).approveTreasury(0n);

      await expect(
        forcedTransferManager.connect(treasuryController1).execute(0n)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotFullyApproved");
    });

    it("Should revert if request does not exist", async function () {
      const { forcedTransferManager, treasuryController1 } = await loadFixture(deployForcedTransferFixture);

      await expect(
        forcedTransferManager.connect(treasuryController1).execute(999n)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotFound");
    });

    it("Should revert if already executed", async function () {
      const { forcedTransferManager, treasuryController1, requestId } = await fullyApprovedRequestFixture();

      // First execution
      await forcedTransferManager.connect(treasuryController1).execute(requestId);

      // Second execution should fail
      await expect(
        forcedTransferManager.connect(treasuryController1).execute(requestId)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotFullyApproved");
    });

    it("Should transfer tokens from blocked/non-allowed user", async function () {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, rwaToken, assetsRegistry, treasuryController1, treasuryController2, auditor, admin, operator, minter, user1, user2 } = fixture;

      // Block user1 (source address)
      await rwaToken.connect(operator).disallowUser(user1.address);
      expect(await rwaToken.isUserAllowed(user1.address)).to.be.false;

      // Create and approve forced transfer
      const dossierTokenId = await mintDossier(assetsRegistry, minter, "blocked-user-transfer");
      const amount = ethers.parseEther("500");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        amount,
        dossierTokenId,
        "Recovery from blocked account"
      );

      await forcedTransferManager.connect(treasuryController2).approveTreasury(0n);
      await forcedTransferManager.connect(auditor).approveAuditor(0n);
      await forcedTransferManager.connect(admin).approveOrgAdmin(0n);

      // Execute should work even though user1 is blocked
      const user2BalanceBefore = await rwaToken.balanceOf(user2.address);
      await forcedTransferManager.connect(treasuryController1).execute(0n);

      expect(await rwaToken.balanceOf(user2.address)).to.equal(user2BalanceBefore + amount);

      // user1 should still be blocked after transfer
      expect(await rwaToken.isUserAllowed(user1.address)).to.be.false;
    });

    it("Should handle frozen tokens correctly", async function () {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, rwaToken, assetsRegistry, treasuryController1, treasuryController2, auditor, admin, operator, minter, user1, user2, initialBalance } = fixture;

      // Freeze some tokens for user1
      const frozenAmount = ethers.parseEther("8000");
      await rwaToken.connect(operator).freeze(user1.address, frozenAmount);
      expect(await rwaToken.frozen(user1.address)).to.equal(frozenAmount);

      // Available balance is now 10000 - 8000 = 2000
      // Try to force transfer 5000 (more than available but less than total)
      const transferAmount = ethers.parseEther("5000");

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "frozen-token-transfer");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        transferAmount,
        dossierTokenId,
        "Recovery including frozen tokens"
      );

      await forcedTransferManager.connect(treasuryController2).approveTreasury(0n);
      await forcedTransferManager.connect(auditor).approveAuditor(0n);
      await forcedTransferManager.connect(admin).approveOrgAdmin(0n);

      // Execute - should transfer 5000 and adjust frozen balance
      await forcedTransferManager.connect(treasuryController1).execute(0n);

      // New balance: 10000 - 5000 = 5000
      // Frozen should be adjusted to min(8000, 5000) = 5000
      expect(await rwaToken.balanceOf(user1.address)).to.equal(initialBalance - transferAmount);
      expect(await rwaToken.frozen(user1.address)).to.equal(initialBalance - transferAmount);
    });

    it("Should revert if destination becomes non-allowed before execution", async function () {
      const { forcedTransferManager, rwaToken, treasuryController1, operator, user2, requestId } = await fullyApprovedRequestFixture();

      // Remove user2 from allowlist after approval
      await rwaToken.connect(operator).disallowUser(user2.address);

      await expect(
        forcedTransferManager.connect(treasuryController1).execute(requestId)
      ).to.be.revertedWithCustomError(forcedTransferManager, "InvalidAddress");
    });
  });

  describe("Cancellation", function () {
    async function initiatedRequestFixture() {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = fixture;

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "cancel-test");
      const amount = ethers.parseEther("1000");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        amount,
        dossierTokenId,
        "May be cancelled"
      );

      return { ...fixture, dossierTokenId, amount, requestId: 0n };
    }

    it("Should allow ORG_ADMIN to cancel pending request", async function () {
      const { forcedTransferManager, admin, requestId } = await initiatedRequestFixture();

      await expect(forcedTransferManager.connect(admin).cancel(requestId))
        .to.emit(forcedTransferManager, "ForcedTransferCancelled")
        .withArgs(requestId, admin.address);

      const request = await forcedTransferManager.getRequest(requestId);
      expect(request.status).to.equal(3n); // CANCELLED
    });

    it("Should allow ORG_ADMIN to cancel approved (but not executed) request", async function () {
      const { forcedTransferManager, treasuryController2, auditor, admin, requestId } = await initiatedRequestFixture();

      // Fully approve
      await forcedTransferManager.connect(treasuryController2).approveTreasury(requestId);
      await forcedTransferManager.connect(auditor).approveAuditor(requestId);
      await forcedTransferManager.connect(admin).approveOrgAdmin(requestId);

      // Cancel
      await expect(forcedTransferManager.connect(admin).cancel(requestId))
        .to.emit(forcedTransferManager, "ForcedTransferCancelled");

      const request = await forcedTransferManager.getRequest(requestId);
      expect(request.status).to.equal(3n); // CANCELLED
    });

    it("Should revert if non-ORG_ADMIN tries to cancel", async function () {
      const { forcedTransferManager, treasuryController1, requestId } = await initiatedRequestFixture();

      await expect(
        forcedTransferManager.connect(treasuryController1).cancel(requestId)
      ).to.be.revertedWithCustomError(forcedTransferManager, "AccessManagedUnauthorized");
    });

    it("Should revert if request is already executed", async function () {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, treasuryController2, auditor, admin, minter, user1, user2 } = fixture;

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "executed-then-cancel");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        ethers.parseEther("100"),
        dossierTokenId,
        "Will be executed"
      );

      await forcedTransferManager.connect(treasuryController2).approveTreasury(0n);
      await forcedTransferManager.connect(auditor).approveAuditor(0n);
      await forcedTransferManager.connect(admin).approveOrgAdmin(0n);
      await forcedTransferManager.connect(treasuryController1).execute(0n);

      await expect(
        forcedTransferManager.connect(admin).cancel(0n)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotPending");
    });

    it("Should revert if request is already cancelled", async function () {
      const { forcedTransferManager, admin, requestId } = await initiatedRequestFixture();

      await forcedTransferManager.connect(admin).cancel(requestId);

      await expect(
        forcedTransferManager.connect(admin).cancel(requestId)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotPending");
    });

    it("Should keep dossier marked as used after cancellation", async function () {
      const { forcedTransferManager, admin, dossierTokenId, requestId } = await initiatedRequestFixture();

      await forcedTransferManager.connect(admin).cancel(requestId);

      // Dossier should still be marked as used (prevents replay)
      expect(await forcedTransferManager.isDossierUsed(dossierTokenId)).to.be.true;
    });
  });

  describe("View Functions", function () {
    it("Should return correct request count", async function () {
      const { forcedTransferManager, assetsRegistry, treasuryController1, minter, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      expect(await forcedTransferManager.getRequestCount()).to.equal(0n);

      for (let i = 0; i < 3; i++) {
        const dossierTokenId = await mintDossier(assetsRegistry, minter, `count-test-${i}`);
        await forcedTransferManager.connect(treasuryController1).initiate(
          user1.address,
          user2.address,
          ethers.parseEther("100"),
          dossierTokenId,
          `Request ${i}`
        );
      }

      expect(await forcedTransferManager.getRequestCount()).to.equal(3n);
    });

    it("Should revert getRequest for non-existent request", async function () {
      const { forcedTransferManager } = await loadFixture(deployForcedTransferFixture);

      await expect(
        forcedTransferManager.getRequest(999n)
      ).to.be.revertedWithCustomError(forcedTransferManager, "RequestNotFound");
    });

    it("Should return correct isFullyApproved status", async function () {
      const fixture = await loadFixture(deployForcedTransferFixture);
      const { forcedTransferManager, assetsRegistry, treasuryController1, treasuryController2, auditor, admin, minter, user1, user2 } = fixture;

      const dossierTokenId = await mintDossier(assetsRegistry, minter, "approval-check");
      
      await forcedTransferManager.connect(treasuryController1).initiate(
        user1.address,
        user2.address,
        ethers.parseEther("100"),
        dossierTokenId,
        "Test"
      );

      expect(await forcedTransferManager.isFullyApproved(0n)).to.be.false;

      await forcedTransferManager.connect(treasuryController2).approveTreasury(0n);
      expect(await forcedTransferManager.isFullyApproved(0n)).to.be.false;

      await forcedTransferManager.connect(auditor).approveAuditor(0n);
      expect(await forcedTransferManager.isFullyApproved(0n)).to.be.false;

      await forcedTransferManager.connect(admin).approveOrgAdmin(0n);
      expect(await forcedTransferManager.isFullyApproved(0n)).to.be.true;
    });
  });

  describe("RWA Token forcedTransfer function", function () {
    it("Should only allow ForcedTransferManager to call forcedTransfer", async function () {
      const { rwaToken, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      // Direct call should fail with custom modifier error
      await expect(
        rwaToken.connect(user1).forcedTransfer(user1.address, user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Caller is not the ForcedTransferManager");
    });

    it("Should allow PROTOCOL_ADMIN to set ForcedTransferManager address", async function () {
      const { rwaToken, protocolAdmin, user1 } = await loadFixture(deployForcedTransferFixture);

      // Protocol admin can update the manager
      await expect(rwaToken.connect(protocolAdmin).setForcedTransferManager(user1.address))
        .to.not.be.reverted;
      
      expect(await rwaToken.forcedTransferManagerContract()).to.equal(user1.address);
    });

    it("Should revert setForcedTransferManager if called by non-PROTOCOL_ADMIN", async function () {
      const { rwaToken, user1, user2 } = await loadFixture(deployForcedTransferFixture);

      await expect(
        rwaToken.connect(user1).setForcedTransferManager(user2.address)
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should revert setForcedTransferManager with zero address", async function () {
      const { rwaToken, protocolAdmin } = await loadFixture(deployForcedTransferFixture);

      await expect(
        rwaToken.connect(protocolAdmin).setForcedTransferManager(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });
});
