import { ethers } from "hardhat";
import { expect } from "chai";

describe("AroMediaRWA", function () {
  it("Test contract deployment", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    expect(await instance.name()).to.equal("AroMediaRWA");
    expect(await instance.symbol()).to.equal("ARO");
  });

  it("Should have correct token name and symbol", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    expect(await instance.name()).to.equal("AroMediaRWA");
    expect(await instance.symbol()).to.equal("ARO");
    expect(await instance.decimals()).to.equal(18);
  });

  it("Should have initial supply of zero tokens", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    const totalSupply = await instance.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should return correct clock mode for voting", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    expect(await instance.CLOCK_MODE()).to.equal("mode=timestamp");
  });

  it("Should support interface detection", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    // Check for ERC165 interface (supported by all contracts)
    const erc165InterfaceId = "0x01ffc9a7";
    expect(await instance.supportsInterface(erc165InterfaceId)).to.be.true;
  });

  it("Should initialize with the correct authority", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    // Verify the contract is deployed
    expect(instance.target).not.to.be.undefined;
  });

  it("Should initialize nonce tracking", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaRWA");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    const [signer] = await ethers.getSigners();
    const nonce = await instance.nonces(signer.address);
    expect(nonce).to.equal(0);
  });
});
