import { AroMediaAccessManager, AroMediaRWA } from "../typechain-types";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { ethers } from "hardhat";
import { expect } from "chai";

describe("AroMediaRWA", function () {
  // Shared fixture for integration testing
  async function deployRWATokenFixture() {
    const [deployer, admin, minter, user1, user2, user3] = await ethers.getSigners();

    // Deploy AccessManager with admin as authority
    const AroMediaAccessManager = await ethers.getContractFactory("AroMediaAccessManager");
    const accessManager = await AroMediaAccessManager.deploy(admin.address);
    await accessManager.waitForDeployment();

    const accessManagerAddr = await accessManager.getAddress();

    // Deploy RWA token with AccessManager as authority
    const AroMediaRWA = await ethers.getContractFactory("AroMediaRWA");
    const rwaToken = await AroMediaRWA.deploy(accessManagerAddr);
    await rwaToken.waitForDeployment();

    const tokenAddr = await rwaToken.getAddress();

    // Configure roles: Set up ISSUER_ROLE for restricted functions
    const ISSUER_ROLE = 1n;
    const issueSelector = rwaToken.interface.getFunction("issue").selector;
    const pauseSelector = rwaToken.interface.getFunction("pause").selector;
    const unpauseSelector = rwaToken.interface.getFunction("unpause").selector;
    const freezeSelector = rwaToken.interface.getFunction("freeze").selector;
    const allowUserSelector = rwaToken.interface.getFunction("allowUser").selector;
    const disallowUserSelector = rwaToken.interface.getFunction("disallowUser").selector;

    await accessManager.connect(admin).setTargetFunctionRole(
      tokenAddr,
      [issueSelector, pauseSelector, unpauseSelector, freezeSelector, allowUserSelector, disallowUserSelector],
      ISSUER_ROLE
    );

    // Grant ISSUER_ROLE to issuer (minter)
    await accessManager.connect(admin).grantRole(ISSUER_ROLE, minter.address, 0);

    return { accessManager, rwaToken, deployer, admin, minter, user1, user2, user3, ISSUER_ROLE };
  }

  describe("Deployment", function () {
    it("Should deploy with correct token name, symbol, and decimals", async function () {
      const { rwaToken } = await loadFixture(deployRWATokenFixture);

      expect(await rwaToken.name()).to.equal("AroMediaRWA");
      expect(await rwaToken.symbol()).to.equal("ARO");
      expect(await rwaToken.decimals()).to.equal(18);
    });

    it("Should have initial supply of 10M tokens issued to treasury", async function () {
      const { rwaToken, accessManager } = await loadFixture(deployRWATokenFixture);

      const initialSupply = ethers.parseEther("10000000"); // 10M tokens
      expect(await rwaToken.totalSupply()).to.equal(initialSupply);
      
      // Treasury (AccessManager) should hold initial tokens
      const treasuryAddress = await accessManager.getAddress();
      expect(await rwaToken.balanceOf(treasuryAddress)).to.equal(initialSupply);
    });

    it("Should return correct CLOCK_MODE", async function () {
      const { rwaToken } = await loadFixture(deployRWATokenFixture);

      expect(await rwaToken.CLOCK_MODE()).to.equal("mode=timestamp");
    });

    it("Should return current block timestamp for clock()", async function () {
      const { rwaToken } = await loadFixture(deployRWATokenFixture);

      const blockTimestamp = (await ethers.provider.getBlock("latest"))!.timestamp;
      const clock = await rwaToken.clock();
      
      // Allow 1 second tolerance
      expect(Number(clock)).to.be.closeTo(blockTimestamp, 1);
    });

    it("Should support ERC165 interface", async function () {
      const { rwaToken } = await loadFixture(deployRWATokenFixture);

      const erc165InterfaceId = "0x01ffc9a7";
      expect(await rwaToken.supportsInterface(erc165InterfaceId)).to.be.true;
    });

    it("Should initialize nonces to zero", async function () {
      const { rwaToken, user1 } = await loadFixture(deployRWATokenFixture);

      expect(await rwaToken.nonces(user1.address)).to.equal(0);
    });

    it("Should have a valid contract address", async function () {
      const { rwaToken } = await loadFixture(deployRWATokenFixture);

      const address = await rwaToken.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("Issuance", function () {
    it("Should allow authorized issuer to issue tokens", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // First, allow the user (strict allowlist)
      await rwaToken.connect(minter).allowUser(user1.address);

      const amount = ethers.parseEther("1000");
      const initialSupply = ethers.parseEther("10000000");

      await expect(rwaToken.connect(minter).issue(user1.address, amount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, amount);

      expect(await rwaToken.balanceOf(user1.address)).to.equal(amount);
      expect(await rwaToken.totalSupply()).to.equal(initialSupply + amount);
    });

    it("Should revert when unauthorized user tries to issue", async function () {
      const { rwaToken, user1, user2 } = await loadFixture(deployRWATokenFixture);

      const amount = ethers.parseEther("1000");

      await expect(
        rwaToken.connect(user1).issue(user2.address, amount)
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should revert when issuing to non-allowed user", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      const amount = ethers.parseEther("1000");

      // user1 is not allowed, issuance should fail
      await expect(
        rwaToken.connect(minter).issue(user1.address, amount)
      ).to.be.revertedWithCustomError(rwaToken, "ERC20UserRestricted");
    });
  });

  describe("User Allowlist (ERC20Restricted)", function () {
    it("Should allow issuer to add users to allowlist", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Initially user is not allowed
      expect(await rwaToken.isUserAllowed(user1.address)).to.be.false;

      // Add to allowlist
      await rwaToken.connect(minter).allowUser(user1.address);

      expect(await rwaToken.isUserAllowed(user1.address)).to.be.true;
    });

    it("Should allow issuer to remove users from allowlist", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Add then remove
      await rwaToken.connect(minter).allowUser(user1.address);
      expect(await rwaToken.isUserAllowed(user1.address)).to.be.true;

      await rwaToken.connect(minter).disallowUser(user1.address);
      expect(await rwaToken.isUserAllowed(user1.address)).to.be.false;
    });

    it("Should revert when unauthorized user tries to allowUser", async function () {
      const { rwaToken, user1, user2 } = await loadFixture(deployRWATokenFixture);

      await expect(
        rwaToken.connect(user1).allowUser(user2.address)
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should revert when unauthorized user tries to disallowUser", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // First allow user2
      await rwaToken.connect(minter).allowUser(user2.address);

      // user1 tries to disallow user2
      await expect(
        rwaToken.connect(user1).disallowUser(user2.address)
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should block transfers from non-allowed users", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Allow user1 and issue to them
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      // Try to transfer to non-allowed user2
      await expect(
        rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(rwaToken, "ERC20UserRestricted");
    });

    it("Should allow transfers between allowed users", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Allow both users
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);

      // Issue to user1
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // Transfer to user2
      const transferAmount = ethers.parseEther("50");
      await expect(rwaToken.connect(user1).transfer(user2.address, transferAmount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, user2.address, transferAmount);

      expect(await rwaToken.balanceOf(user1.address)).to.equal(amount - transferAmount);
      expect(await rwaToken.balanceOf(user2.address)).to.equal(transferAmount);
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow authorized user to pause the contract", async function () {
      const { rwaToken, minter } = await loadFixture(deployRWATokenFixture);

      await expect(rwaToken.connect(minter).pause())
        .to.emit(rwaToken, "Paused")
        .withArgs(minter.address);

      expect(await rwaToken.paused()).to.be.true;
    });

    it("Should allow authorized user to unpause the contract", async function () {
      const { rwaToken, minter } = await loadFixture(deployRWATokenFixture);

      await rwaToken.connect(minter).pause();

      await expect(rwaToken.connect(minter).unpause())
        .to.emit(rwaToken, "Unpaused")
        .withArgs(minter.address);

      expect(await rwaToken.paused()).to.be.false;
    });

    it("Should revert when unauthorized user tries to pause", async function () {
      const { rwaToken, user1 } = await loadFixture(deployRWATokenFixture);

      await expect(
        rwaToken.connect(user1).pause()
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should block transfers when paused", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup: Allow users and issue
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      // Pause
      await rwaToken.connect(minter).pause();

      // Transfer should fail
      await expect(
        rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(rwaToken, "EnforcedPause");
    });

    it("Should block issuance when paused", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).pause();

      await expect(
        rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(rwaToken, "EnforcedPause");
    });

    it("Should allow transfers after unpause", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      // Pause then unpause
      await rwaToken.connect(minter).pause();
      await rwaToken.connect(minter).unpause();

      // Transfer should work
      await expect(rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("50")))
        .to.emit(rwaToken, "Transfer");
    });
  });

  describe("Freezing (ERC20Freezable)", function () {
    it("Should allow authorized user to freeze tokens", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Setup: Allow and issue
      await rwaToken.connect(minter).allowUser(user1.address);
      const issueAmount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, issueAmount);

      // Freeze half
      const freezeAmount = ethers.parseEther("50");
      await rwaToken.connect(minter).freeze(user1.address, freezeAmount);

      expect(await rwaToken.frozen(user1.address)).to.equal(freezeAmount);
      expect(await rwaToken.available(user1.address)).to.equal(issueAmount - freezeAmount);
    });

    it("Should block transfers exceeding available (unfrozen) balance", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      const issueAmount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, issueAmount);

      // Freeze 60, leaving 40 available
      await rwaToken.connect(minter).freeze(user1.address, ethers.parseEther("60"));

      // Try to transfer 50 (exceeds available 40)
      await expect(
        rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(rwaToken, "ERC20InsufficientUnfrozenBalance");
    });

    it("Should allow transfers within available balance", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      // Freeze 60, leaving 40 available
      await rwaToken.connect(minter).freeze(user1.address, ethers.parseEther("60"));

      // Transfer 40 (exactly available amount)
      await expect(rwaToken.connect(user1).transfer(user2.address, ethers.parseEther("40")))
        .to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, user2.address, ethers.parseEther("40"));

      expect(await rwaToken.balanceOf(user2.address)).to.equal(ethers.parseEther("40"));
    });

    it("Should revert when unauthorized user tries to freeze", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      await expect(
        rwaToken.connect(user2).freeze(user1.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(rwaToken, "AccessManagedUnauthorized");
    });

    it("Should allow unfreezing by setting freeze to 0", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));
      await rwaToken.connect(minter).freeze(user1.address, ethers.parseEther("50"));

      expect(await rwaToken.frozen(user1.address)).to.equal(ethers.parseEther("50"));

      // Unfreeze
      await rwaToken.connect(minter).freeze(user1.address, 0);

      expect(await rwaToken.frozen(user1.address)).to.equal(0);
      expect(await rwaToken.available(user1.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Burning (ERC20Burnable)", function () {
    it("Should allow users to burn their own tokens", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      const burnAmount = ethers.parseEther("30");
      await expect(rwaToken.connect(user1).burn(burnAmount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);

      expect(await rwaToken.balanceOf(user1.address)).to.equal(amount - burnAmount);
    });

    it("Should allow approved user to burnFrom", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // user1 approves user2
      const burnAmount = ethers.parseEther("30");
      await rwaToken.connect(user1).approve(user2.address, burnAmount);

      // user2 burns from user1
      await expect(rwaToken.connect(user2).burnFrom(user1.address, burnAmount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);

      expect(await rwaToken.balanceOf(user1.address)).to.equal(amount - burnAmount);
    });
  });

  describe("ERC20Permit", function () {
    it("Should allow permit-based approvals", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      const tokenAddress = await rwaToken.getAddress();
      const deadline = (await time.latest()) + 3600; // 1 hour from now
      const value = ethers.parseEther("50");
      const nonce = await rwaToken.nonces(user1.address);

      // Get domain separator
      const domain = {
        name: "AroMediaRWA",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: user1.address,
        spender: user2.address,
        value: value,
        nonce: nonce,
        deadline: deadline,
      };

      // Sign the permit
      const signature = await user1.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);

      // Execute permit
      await expect(rwaToken.permit(user1.address, user2.address, value, deadline, v, r, s))
        .to.emit(rwaToken, "Approval")
        .withArgs(user1.address, user2.address, value);

      expect(await rwaToken.allowance(user1.address, user2.address)).to.equal(value);
      expect(await rwaToken.nonces(user1.address)).to.equal(nonce + 1n);
    });

    it("Should revert permit with expired deadline", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      await rwaToken.connect(minter).allowUser(user1.address);

      const tokenAddress = await rwaToken.getAddress();
      const deadline = (await time.latest()) - 1; // Already expired
      const value = ethers.parseEther("50");
      const nonce = await rwaToken.nonces(user1.address);

      const domain = {
        name: "AroMediaRWA",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: user1.address,
        spender: user2.address,
        value: value,
        nonce: nonce,
        deadline: deadline,
      };

      const signature = await user1.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);

      await expect(
        rwaToken.permit(user1.address, user2.address, value, deadline, v, r, s)
      ).to.be.revertedWithCustomError(rwaToken, "ERC2612ExpiredSignature");
    });
  });

  describe("ERC20Votes", function () {
    it("Should allow delegation of votes", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // Before delegation, voting power is 0
      expect(await rwaToken.getVotes(user1.address)).to.equal(0);
      expect(await rwaToken.getVotes(user2.address)).to.equal(0);

      // user1 delegates to user2
      await expect(rwaToken.connect(user1).delegate(user2.address))
        .to.emit(rwaToken, "DelegateChanged")
        .withArgs(user1.address, ethers.ZeroAddress, user2.address);

      // user2 now has voting power
      expect(await rwaToken.getVotes(user2.address)).to.equal(amount);
      expect(await rwaToken.delegates(user1.address)).to.equal(user2.address);
    });

    it("Should allow self-delegation", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // Self-delegate
      await rwaToken.connect(user1).delegate(user1.address);

      expect(await rwaToken.getVotes(user1.address)).to.equal(amount);
      expect(await rwaToken.delegates(user1.address)).to.equal(user1.address);
    });

    it("Should update voting power after transfers", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // Both self-delegate
      await rwaToken.connect(user1).delegate(user1.address);
      await rwaToken.connect(user2).delegate(user2.address);

      expect(await rwaToken.getVotes(user1.address)).to.equal(amount);
      expect(await rwaToken.getVotes(user2.address)).to.equal(0);

      // Transfer from user1 to user2
      const transferAmount = ethers.parseEther("40");
      await rwaToken.connect(user1).transfer(user2.address, transferAmount);

      expect(await rwaToken.getVotes(user1.address)).to.equal(amount - transferAmount);
      expect(await rwaToken.getVotes(user2.address)).to.equal(transferAmount);
    });

    it("Should track historical voting power with getPastVotes", async function () {
      const { rwaToken, minter, user1 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      const amount = ethers.parseEther("100");
      await rwaToken.connect(minter).issue(user1.address, amount);

      // Self-delegate
      await rwaToken.connect(user1).delegate(user1.address);

      // Get current timestamp
      const timestamp1 = await rwaToken.clock();

      // Advance time
      await time.increase(60);

      // Issue more
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("50"));

      // Check historical votes
      expect(await rwaToken.getPastVotes(user1.address, timestamp1)).to.equal(amount);
    });
  });

  describe("Approvals", function () {
    it("Should emit Approval event on approve", async function () {
      const { rwaToken, minter, user1, user2 } = await loadFixture(deployRWATokenFixture);

      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      const amount = ethers.parseEther("50");
      await expect(rwaToken.connect(user1).approve(user2.address, amount))
        .to.emit(rwaToken, "Approval")
        .withArgs(user1.address, user2.address, amount);

      expect(await rwaToken.allowance(user1.address, user2.address)).to.equal(amount);
    });

    it("Should allow transferFrom with approval", async function () {
      const { rwaToken, minter, user1, user2, user3 } = await loadFixture(deployRWATokenFixture);

      // Setup
      await rwaToken.connect(minter).allowUser(user1.address);
      await rwaToken.connect(minter).allowUser(user2.address);
      await rwaToken.connect(minter).allowUser(user3.address);
      await rwaToken.connect(minter).issue(user1.address, ethers.parseEther("100"));

      // user1 approves user2
      const approveAmount = ethers.parseEther("50");
      await rwaToken.connect(user1).approve(user2.address, approveAmount);

      // user2 transfers from user1 to user3
      const transferAmount = ethers.parseEther("30");
      await expect(rwaToken.connect(user2).transferFrom(user1.address, user3.address, transferAmount))
        .to.emit(rwaToken, "Transfer")
        .withArgs(user1.address, user3.address, transferAmount);

      expect(await rwaToken.balanceOf(user3.address)).to.equal(transferAmount);
      expect(await rwaToken.allowance(user1.address, user2.address)).to.equal(approveAmount - transferAmount);
    });
  });
});
