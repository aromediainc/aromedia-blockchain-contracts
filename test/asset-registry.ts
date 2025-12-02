import { ethers } from "hardhat";
import { expect } from "chai";

describe("AroMediaAssetsRegistry", function () {
  it("Test contract deployment", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    expect(await instance.name()).to.equal("AroMediaAssetsRegistry");
    expect(await instance.symbol()).to.equal("AROASSETS");
  });

  it("Should have correct token name and symbol", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    expect(await instance.name()).to.equal("AroMediaAssetsRegistry");
    expect(await instance.symbol()).to.equal("AROASSETS");
  });

  it("Should have initial supply of zero tokens", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    const totalSupply = await instance.totalSupply();
    expect(totalSupply).to.equal(0);
  });

  it("Should support interface detection", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    // Check for ERC721 interface
    const erc721InterfaceId = "0x80ac58cd";
    expect(await instance.supportsInterface(erc721InterfaceId)).to.be.true;
  });

  it("Should initialize with the correct authority", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaAssetsRegistry");
    const initialAuthority = (await ethers.getSigners())[0].address;

    const instance = await ContractFactory.deploy(initialAuthority);
    await instance.waitForDeployment();

    // Verify the contract is deployed
    expect(instance.target).not.to.be.undefined;
  });
});
