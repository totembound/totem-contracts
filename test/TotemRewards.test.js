const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TotemRewards", function () {
    let TotemRewards, TotemToken, TotemProxy, TotemProxyAdmin;
    let rewards, token, proxy, proxyAdmin;
    let owner, addr1, addr2, trustedForwarder, oracle;

    // Test reward configurations
    const dailyRewardId = ethers.id("daily_login");
    const weeklyRewardId = ethers.id("weekly_bonus");

    const dailyConfig = {
        baseAmount: ethers.parseUnits("10", 18),     // 10 TOTEM
        interval: 86400,                             // 24 hours
        streakBonus: 5,                             // 5% per day
        maxStreakBonus: 100,                        // Max 100% bonus
        minStreak: 0,                               // No minimum
        gracePeriod: 3600,                          // 1-hour grace period
        allowProtection: true,
        enabled: true,
        protectionTierCount: 2                      // Two protection tiers
    };

    const weeklyConfig = {
        baseAmount: ethers.parseUnits("100", 18),    // 100 TOTEM
        interval: 604800,                            // 7 days
        streakBonus: 10,                             // 10% per week
        maxStreakBonus: 100,                         // Max 100% bonus
        minStreak: 1,                                // Require 1 week streak
        gracePeriod: 86400,                          // 1-day grace period
        allowProtection: true,
        enabled: true,
        protectionTierCount: 1                       // One protection tier
    };

    beforeEach(async function () {
        [owner, addr1, addr2, trustedForwarder] = await ethers.getSigners();

        // Deploy price oracle
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));

        // Deploy implementation
        TotemToken = await ethers.getContractFactory("TotemToken");
        const implementation = await TotemToken.deploy();

        // Deploy proxy admin
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // Prepare initialization data
        const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
            await oracle.getAddress()
        ]);

        // Deploy proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        tokenProxy = await TotemProxy.deploy(
            await implementation.getAddress(),
            await proxyAdmin.getAddress(),
            initTokenData
        );

        // Get token interface at proxy address
        token = await ethers.getContractAt("TotemToken", await tokenProxy.getAddress());

        // Deploy Rewards Implementation
        TotemRewards = await ethers.getContractFactory("TotemRewards");
        const rewardsImpl = await TotemRewards.deploy();

        // Initialize implementation data
        const initData = TotemRewards.interface.encodeFunctionData("initialize", [
            await token.getAddress(),
            trustedForwarder.address
        ]);

        // Deploy and initialize proxy
        proxy = await TotemProxy.deploy(
            await rewardsImpl.getAddress(),
            owner.address,
            initData
        );

        // Get rewards contract interface at proxy address
        rewards = await ethers.getContractAt("TotemRewards", await proxy.getAddress());

        // Transfer tokens to rewards contract
        await token.transferAllocation(
            1, // Rewards category
            await rewards.getAddress(),
            ethers.parseUnits("150000000", 18)
        );

        // Configure rewards
        await rewards.configureReward(
            dailyRewardId,
            "Daily Login",
            "Daily login reward",
            "ipfs://daily-icon",
            dailyConfig
        );

        await rewards.configureReward(
            weeklyRewardId,
            "Weekly Bonus",
            "Weekly bonus reward",
            "ipfs://weekly-icon",
            weeklyConfig
        );

        // Configure protection tiers
        await rewards.configureProtectionTier(dailyRewardId, 0, {
            cost: ethers.parseUnits("50", 18),       // 50 TOTEM
            duration: 86400,                         // 1 day
            requiredStreak: 7,                       // Need 7-day streak
            enabled: true
        });

        await rewards.configureProtectionTier(dailyRewardId, 1, {
            cost: ethers.parseUnits("250", 18),      // 250 TOTEM
            duration: 604800,                        // 7 days
            requiredStreak: 14,                      // Need 14-day streak
            enabled: true
        });

        await rewards.configureProtectionTier(weeklyRewardId, 0, {
            cost: ethers.parseUnits("500", 18),      // 500 TOTEM
            duration: 1209600,                       // 14 days
            requiredStreak: 4,                       // Need 4-week streak
            enabled: true
        });
    });

    describe("Initialization", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await rewards.totemToken()).to.equal(await token.getAddress());
            expect(await rewards.trustedForwarder()).to.equal(trustedForwarder.address);
        });

        it("Should have rewards properly configured", async function () {
            const rewardIds = await rewards.getRewardIds();
            expect(rewardIds).to.have.lengthOf(2);
            expect(rewardIds).to.include(dailyRewardId);
            expect(rewardIds).to.include(weeklyRewardId);

            const [name, description, , config] = await rewards.getRewardInfo(dailyRewardId);
            expect(name).to.equal("Daily Login");
            expect(config.baseAmount).to.equal(dailyConfig.baseAmount);
            expect(config.interval).to.equal(dailyConfig.interval);
        });
    });

    describe("Reward Claiming", function () {
        beforeEach(async function () {
            // Enable rewards before each test
            await rewards.enableReward(dailyRewardId);
            await rewards.enableReward(weeklyRewardId);
        });

        it("Should allow claiming daily reward", async function () {
            const initialBalance = await token.balanceOf(addr1.address);
            
            // Verify claiming is allowed
            expect(await rewards.isClaimingAllowed(dailyRewardId, addr1.address)).to.be.true;
            
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const newBalance = await token.balanceOf(addr1.address);
            expect(newBalance).to.equal(initialBalance + dailyConfig.baseAmount);
        });

        it("Should prevent double claims within interval", async function () {
            await rewards.connect(addr1).claim(dailyRewardId);
            
            await expect(rewards.connect(addr1).claim(dailyRewardId))
                .to.be.revertedWithCustomError(rewards, "ClaimingCurrentlyNotAllowed");
        });

        it("Should allow claiming after interval", async function () {
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Move time forward past interval
            await time.increase(dailyConfig.interval + 1);
            
            // Should be able to claim again
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const tracking = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(tracking.currentStreak).to.equal(2n);
        });

        it("Should apply streak bonus correctly", async function () {
            // First claim
            await rewards.connect(addr1).claim(dailyRewardId);
            let balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(dailyConfig.baseAmount);

            // Move time forward and claim again
            await time.increase(dailyConfig.interval + 1);
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const expectedBonus = dailyConfig.baseAmount * BigInt(5) / BigInt(100); // 5% bonus
            balance = await token.balanceOf(addr1.address);
            expect(balance).to.equal(dailyConfig.baseAmount * 2n + expectedBonus);
        });
    });

    describe("Protection System", function () {
        beforeEach(async function () {
            // Enable rewards
            await rewards.enableReward(dailyRewardId);
            await rewards.enableReward(weeklyRewardId);

            // Build up required streak
            for(let i = 0; i < 7; i++) {
                await rewards.connect(addr1).claim(dailyRewardId);
                await time.increase(dailyConfig.interval);
            }
            // Approve tokens for protection purchase, transfer from game to user
            await token.transferAllocation(0, addr1.address, ethers.parseUnits("1000", 18));
            await token.connect(addr1).approve(
                await rewards.getAddress(),
                ethers.parseUnits("1000", 18)
            );
        });

        it("Should allow purchasing protection", async function () {
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 0);
            
            const userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.protectionExpiry).to.be.gt(0);
            expect(userInfo.activeTier).to.equal(0);
        });

        it("Should maintain streak when protected", async function () {
            // Purchase protection
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 0);
            
            // Check protection status
            const beforeInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            const currentTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            expect(beforeInfo.protectionExpiry).to.be.gt(currentTimestamp);

            // Check if claiming is allowed
            const isAllowed = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
            expect(isAllowed).to.be.true;
            
            // Should still be able to claim and maintain streak
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(8n);
        });

        it("Should prevent protection purchase without required streak", async function () {
            await expect(rewards.connect(addr2).purchaseProtection(dailyRewardId, 0))
                .to.be.revertedWithCustomError(rewards, "InsufficientStreak");
        });

        it("Should prevent double protection purchase", async function () {
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 0);
            
            await expect(rewards.connect(addr1).purchaseProtection(dailyRewardId, 0))
                .to.be.revertedWithCustomError(rewards, "ProtectionAlreadyActive");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow updating reward configuration", async function () {
            const newConfig = {
                ...dailyConfig,
                baseAmount: ethers.parseUnits("20", 18)
            };

            await rewards.configureReward(
                dailyRewardId,
                "Daily Login",
                "Updated daily reward",
                "ipfs://new-icon",
                newConfig
            );

            const [, , , config] = await rewards.getRewardInfo(dailyRewardId);
            expect(config.baseAmount).to.equal(newConfig.baseAmount);
        });

        it("Should allow updating protection tiers", async function () {
            const newTier = {
                cost: ethers.parseUnits("75", 18),
                duration: 172800,                 // 2 days
                requiredStreak: 10,
                enabled: true
            };

            await rewards.configureProtectionTier(dailyRewardId, 0, newTier);
            
            const tier = await rewards.getProtectionTier(dailyRewardId, 0);
            expect(tier.cost).to.equal(newTier.cost);
            expect(tier.duration).to.equal(newTier.duration);
            expect(tier.requiredStreak).to.equal(newTier.requiredStreak);
        });

        it("Should allow setting metadata attributes", async function () {
            await rewards.setRewardMetadataAttribute(
                dailyRewardId,
                "category",
                "login"
            );

            const value = await rewards.getMetadataAttribute(dailyRewardId, "category");
            expect(value).to.equal("login");
        });
    });
});