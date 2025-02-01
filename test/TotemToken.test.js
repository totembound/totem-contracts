const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TotemToken", function () {
    let TotemToken, token, owner, addr1, addr2, oracle;
    const TOTAL_SUPPLY = ethers.parseUnits("1000000000", 18); // 1 billion tokens
    
    // Categories as enum
    const AllocationCategory = {
        Game: 0,
        Rewards: 1,
        Ecosystem: 2,
        Liquidity: 3,
        Marketing: 4,
        Team: 5,
        Reserved: 6
    };

    // Expected initial allocations
    const INITIAL_ALLOCATIONS = {
        [AllocationCategory.Game]: ethers.parseUnits("250000000", 18),      // 250M (25%)
        [AllocationCategory.Rewards]: ethers.parseUnits("150000000", 18),   // 150M (15%)
        [AllocationCategory.Ecosystem]: ethers.parseUnits("100000000", 18), // 100M (10%)
        [AllocationCategory.Liquidity]: ethers.parseUnits("100000000", 18), // 100M (10%)
        [AllocationCategory.Marketing]: ethers.parseUnits("150000000", 18), // 150M (15%)
        [AllocationCategory.Team]: ethers.parseUnits("200000000", 18),      // 200M (20%)
        [AllocationCategory.Reserved]: ethers.parseUnits("50000000", 18)    // 50M (5%)
    };

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        // Deploy admin oracle first
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));
        
        // Deploy token
        TotemToken = await ethers.getContractFactory("TotemToken");
        token = await TotemToken.deploy(await oracle.getAddress());
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });

        it("Should assign total supply to contract initially", async function () {
            expect(await token.balanceOf(await token.getAddress())).to.equal(TOTAL_SUPPLY);
        });

        it("Should initialize allocations correctly", async function () {
            for (const [category, expectedAmount] of Object.entries(INITIAL_ALLOCATIONS)) {
                const allocation = await token.getRemainingAllocation(category);
                expect(allocation).to.equal(expectedAmount);
            }
        });

        it("Should emit TokenCreated and TokenAllocationsInitialized events", async function () {
            // For deployment events, we need to deploy the contract within the test
            const newToken = await (await ethers.getContractFactory("TotemToken"))
                .deploy(await oracle.getAddress());

            await expect(newToken.deploymentTransaction())
                .to.emit(newToken, "TokenCreated")
                .withArgs(owner.address, TOTAL_SUPPLY, await time.latest());
            
            await expect(newToken.deploymentTransaction())
                .to.emit(newToken, "TokenAllocationsInitialized");
        });
    });

    describe("Allocation Management", function () {
        it("Should transfer allocation to recipient", async function () {
            const recipient = addr1.address;
            const amount = ethers.parseUnits("1000", 18);
            const category = AllocationCategory.Marketing;

            await expect(token.transferAllocation(category, recipient, amount))
                .to.emit(token, "AllocationTransferred")
                .withArgs(category, recipient, amount);

            const remainingAllocation = await token.getRemainingAllocation(category);
            expect(remainingAllocation).to.equal(INITIAL_ALLOCATIONS[category] - amount);
            expect(await token.balanceOf(recipient)).to.equal(amount);
        });

        it("Should transfer between categories", async function () {
            const amount = ethers.parseUnits("1000", 18);
            const fromCategory = AllocationCategory.Reserved;
            const toCategory = AllocationCategory.Marketing;

            await expect(token.transferBetweenCategories(fromCategory, toCategory, amount))
                .to.emit(token, "CrossCategoryTransfer")
                .withArgs(fromCategory, toCategory, amount);

            expect(await token.getRemainingAllocation(fromCategory))
                .to.equal(INITIAL_ALLOCATIONS[fromCategory] - amount);
            expect(await token.getRemainingAllocation(toCategory))
                .to.equal(INITIAL_ALLOCATIONS[toCategory] + amount);
        });

        it("Should fail on insufficient allocation", async function () {
            const tooMuch = INITIAL_ALLOCATIONS[AllocationCategory.Marketing] + ethers.parseUnits("1", 18);
            await expect(token.transferAllocation(AllocationCategory.Marketing, addr1.address, tooMuch))
                .to.be.revertedWithCustomError(token, "InsufficientAllocation");
        });

        it("Should fail on invalid amount", async function () {
            await expect(token.transferAllocation(AllocationCategory.Marketing, addr1.address, 0))
                .to.be.revertedWithCustomError(token, "InvalidAmount");
        });
    });

    describe("Oracle Integration", function () {
        it("Should get token price from oracle", async function () {
            const price = await token.getTokenPrice();
            expect(price).to.equal(await oracle.getPrice());
        });

        it("Should get last price update time", async function () {
            const lastUpdate = await token.getLastPriceUpdate();
            expect(lastUpdate).to.equal(await oracle.getLastUpdate());
        });

        it("Should update oracle address", async function () {
            const newOracle = await (await ethers.getContractFactory("TotemAdminPriceOracle"))
                .deploy(ethers.parseUnits("0.02", "ether"));
            
            await expect(token.updateOracle(await newOracle.getAddress()))
                .to.emit(token, "OracleUpdated")
                .withArgs(await newOracle.getAddress());

            expect(await token.priceOracle()).to.equal(await newOracle.getAddress());
        });

        it("Should reject invalid oracle addresses", async function () {
            await expect(token.updateOracle(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(token, "InvalidAddress");
        });
    });

    describe("Pausable Functionality", function () {
        it("Should pause and unpause transfers", async function () {
            // First transfer some tokens to addr1
            await token.transferAllocation(AllocationCategory.Marketing, addr1.address, ethers.parseUnits("1000", 18));

            await token.pause();
            await expect(token.connect(addr1).transfer(addr2.address, 100))
                .to.be.revertedWithCustomError(token, "EnforcedPause");

            await token.unpause();
            await token.connect(addr1).transfer(addr2.address, 100);
            expect(await token.balanceOf(addr2.address)).to.equal(100);
        });

        it("Should only allow owner to pause/unpause", async function () {
            await expect(token.connect(addr1).pause())
                .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);

            await expect(token.connect(addr1).unpause())
                .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
                .withArgs(addr1.address);
        });
    });

    describe("Emergency Functions", function () {
        it("Should recover accidentally sent ERC20 tokens", async function () {
            // Deploy a mock ERC20 token
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const mockToken = await MockERC20.deploy();
            
            // Send some mock tokens to the TotemToken contract
            await mockToken.transfer(await token.getAddress(), ethers.parseUnits("1", 18));

            // Recover the tokens
            await expect(token.recoverERC20(await mockToken.getAddress(), ethers.parseUnits("1", 18)))
                .to.changeTokenBalances(
                    mockToken,
                    [token, owner],
                    [ethers.parseUnits("-1", 18), ethers.parseUnits("1", 18)]
                );
        });

        it("Should not recover when token address is zero", async function () {
          await expect(token.recoverERC20(ethers.ZeroAddress, ethers.parseUnits("1", 18)))
              .to.be.revertedWithCustomError(token, "InvalidAddress");
        });

        it("Should not recover when token address is token", async function () {
          await expect(token.recoverERC20(token, ethers.parseUnits("1", 18)))
              .to.be.revertedWithCustomError(token, "CannotRecoverToken");
        });

        it("Should not recover TOTEM tokens", async function () {
            const someAmount = ethers.parseUnits("1", 18);
            
            // First transfer some tokens to test with
            await token.transferAllocation(AllocationCategory.Reserved, owner.address, someAmount);
            
            // Try to recover the tokens
            await expect(token.recoverERC20(await token.getAddress(), someAmount))
                .to.be.revertedWithCustomError(token, "CannotRecoverToken");
        });
    });
});