import { ethers } from "hardhat";
import { expect } from "chai";

describe("AroMediaIncMultiSig", function () {
  it("Test contract deployment", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaIncMultiSig");
    
    const signer = (await ethers.getSigners())[0];
    const signers = [signer.address];
    const threshold = 1n;
    
    // Encode the signer address as bytes
    const encodedSigners = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signers[0]])];

    const instance = await ContractFactory.deploy(encodedSigners, threshold);
    await instance.waitForDeployment();
    
    expect(instance.target).not.to.be.undefined;
  });

  it("Should support multiple signers", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaIncMultiSig");
    
    const signers = await ethers.getSigners();
    const signer1 = signers[0];
    const signer2 = signers[1];
    
    const encodedSigners = [
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signer1.address]),
      ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signer2.address])
    ];
    
    const threshold = 2n;
    
    const instance = await ContractFactory.deploy(encodedSigners, threshold);
    await instance.waitForDeployment();
    
    expect(instance.target).not.to.be.undefined;
  });

  it("Should support threshold configuration", async function () {
    const ContractFactory = await ethers.getContractFactory("AroMediaIncMultiSig");
    
    const signer = (await ethers.getSigners())[0];
    const encodedSigners = [ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signer.address])];
    const threshold = 1n;
    
    const instance = await ContractFactory.deploy(encodedSigners, threshold);
    await instance.waitForDeployment();
    
    expect(instance.target).not.to.be.undefined;
  });
});
