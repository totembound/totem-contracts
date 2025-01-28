const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemToken", function () {
  let TotemToken, token, owner, addr1, addr2, oracle, gameProxy;
  const TOTAL_SUPPLY = ethers.parseEther("1000000000"); // 1 billion tokens

  beforeEach(async function () {
    // Deploy mock oracle first
    const MockOracle = await ethers.getContractFactory("MockPriceOracle");
    oracle = await MockOracle.deploy();

    [owner, addr1, addr2, gameProxy] = await ethers.getSigners();
    
    TotemToken = await ethers.getContractFactory("TotemToken");
    token = await TotemToken.deploy(await oracle.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign initial token allocations correctly", async function () {
      const initialGameplay = (TOTAL_SUPPLY * 25n) / 100n;
      const ownerAllocation = (TOTAL_SUPPLY * 75n) / 100n;

      expect(await token.balanceOf(await token.getAddress())).to.equal(initialGameplay);
      expect(await token.balanceOf(owner.address)).to.equal(ownerAllocation);
    });
  });

  describe("Oracle functionality", function () {
    it("Should get token price from oracle", async function () {
      const price = await token.getTokenPrice();
      expect(price).to.equal(await oracle.getPrice());
    });

    it("Should update oracle address", async function () {
      const NewMockOracle = await ethers.getContractFactory("MockPriceOracle");
      const newOracle = await NewMockOracle.deploy();
      
      await token.updateOracle(await newOracle.getAddress());
      expect(await token.priceOracle()).to.equal(await newOracle.getAddress());
    });
  });

  describe("Gameplay token management", function () {
    it("Should set game proxy and transfer gameplay tokens", async function () {
      await token.updateGameProxy(gameProxy.address);
      await token.transferGameplayAllocation();

      const gameplayBalance = (TOTAL_SUPPLY * 25n) / 100n;
      expect(await token.balanceOf(gameProxy.address)).to.equal(gameplayBalance);
      expect(await token.gameplayTokensTransferred()).to.be.true;
    });

    it("Should not allow transferring gameplay tokens twice", async function () {
      await token.updateGameProxy(gameProxy.address);
      await token.transferGameplayAllocation();

      await expect(token.transferGameplayAllocation())
        .to.be.revertedWith("Gameplay tokens already transferred");
    });
  });

  describe("Pause functionality", function () {
    it("Should pause and unpause transfers", async function () {
      await token.pause();
      await expect(token.transfer(addr1.address, 100))
        .to.be.revertedWithCustomError(token, "EnforcedPause");

      await token.unpause();
      await expect(token.transfer(addr1.address, 100))
        .to.not.be.reverted;
    });
  });

  describe("Emergency functions", function () {
    it("Should recover mistakenly sent ERC20 tokens", async function () {
      // Deploy a simple mock ERC20 token
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockERC20.deploy();

      const amount = ethers.parseEther("1"); // 1 token with 18 decimals
      const initialBalance = await mockToken.balanceOf(owner.address);

      // Send some mock tokens to the TotemToken contract
      await mockToken.transfer(await token.getAddress(), amount);

      // Recover the tokens
      await token.recoverERC20(await mockToken.getAddress(), amount);
      
      // Check that balance is restored to initial amount
      expect(await mockToken.balanceOf(owner.address)).to.equal(initialBalance);
    });

    it("Should not allow recovering TOTEM tokens", async function () {
      await expect(token.recoverERC20(await token.getAddress(), 1000))
        .to.be.revertedWith("Cannot recover TOTEM");
    });
  });
});
