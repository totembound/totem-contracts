const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { safeIncreaseTo } = require("./timeHelpers");

describe("TotemRewards", function () {
    let TotemRewards, TotemToken, TotemGame, TotemNFT;
    let rewards, token, proxy, proxyAdmin;
    let owner, addr1, addr2, trustedForwarder, oracle, randomOracle;

    // Test reward configurations
    const dailyRewardId = ethers.id("daily_login");
    const weeklyRewardId = ethers.id("weekly_bonus");

    const dailyConfig = {
        baseAmount: ethers.parseUnits("10", 18),    // 10 TOTEM
        interval: 86400,                            // 24 hours
        streakBonus: 5,                             // 5% per day
        maxStreakBonus: 100,                        // Max 100% bonus
        minStreak: 0,                               // No minimum
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
        allowProtection: true,
        enabled: true,
        protectionTierCount: 1                       // One protection tier
    };

    // Initial game parameters
    const gameParams = {
        signupReward: ethers.parseUnits("2000", 18),    // 2000 TOTEM
        mintPrice: ethers.parseUnits("500", 18)         // 500 TOTEM
    };

    // Time windows for feeding (in seconds from start of day UTC)
    const timeWindows = {
        window1Start: 0n,      // 00:00 UTC
        window2Start: 28800n,  // 08:00 UTC
        window3Start: 57600n   // 16:00 UTC
    };
    
    beforeEach(async function () {
        [owner, addr1, addr2, trustedForwarder] = await ethers.getSigners();

        // Deploy price oracle
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));

        // Deploy random oracle
        const MockRandomOracle = await ethers.getContractFactory("MockRandomOracle");
        randomOracle = await MockRandomOracle.deploy();
        
        // Deploy proxy admin
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // Deploy implementation
        TotemToken = await ethers.getContractFactory("TotemToken");
        const tokenImpl = await TotemToken.deploy();
        // Prepare initialization data
        const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
            await oracle.getAddress(),
            trustedForwarder.address
        ]);

        // Deploy proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        tokenProxy = await TotemProxy.deploy(
            await tokenImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initTokenData
        );
        // Get token interface at proxy address
        token = await ethers.getContractAt("TotemToken", await tokenProxy.getAddress());

        // Deploy NFT contract
        TotemNFT = await ethers.getContractFactory("TotemNFT");
        const nftImpl = await TotemNFT.deploy();
        const initNFTData = TotemNFT.interface.encodeFunctionData("initialize", [
            trustedForwarder.address
        ]);
        const nftProxy = await TotemProxy.deploy(
            await nftImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initNFTData
        );
        nft = await ethers.getContractAt("TotemNFT", await nftProxy.getAddress());
        await nft.setRandomOracle(await randomOracle.getAddress());

        // Deploy Game contract
        TotemGame = await ethers.getContractFactory("TotemGame");
        const gameImpl = await TotemGame.deploy();
        const initGameData = TotemGame.interface.encodeFunctionData("initialize", [
            await token.getAddress(),
            await nft.getAddress(),
            trustedForwarder.address,
            gameParams,
            timeWindows
        ]);
        const gameProxy = await TotemProxy.deploy(
            await gameImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initGameData
        );
        game = await ethers.getContractAt("TotemGame", await gameProxy.getAddress());

        // Deploy Rewards Implementation
        TotemRewards = await ethers.getContractFactory("TotemRewards");
        const rewardsImpl = await TotemRewards.deploy();

        // Initialize implementation data
        const initData = TotemRewards.interface.encodeFunctionData("initialize", [
            await game.getAddress(),
            await token.getAddress(),
            await nft.getAddress(),
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
        
        // Enable rewards
        await rewards.enableReward(dailyRewardId);
        await rewards.enableReward(weeklyRewardId);
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
        async function setupClaimTests(contract, user, config) {
            // Get current block timestamp
            const currentTimestamp = await time.latest();
            
            // Calculate next UTC midnight
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            
            // Safely increase to next midnight
            await safeIncreaseTo(nextMidnight);

            // Initial claim
            await contract.connect(user).claim(dailyRewardId);
            const initialBalance = await token.balanceOf(user.address);

            // Move time forward past midnight
            await time.increase(config.interval);

            return initialBalance;
        }

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
            const initialBalance = await setupClaimTests(rewards, addr1, dailyConfig);
            
            // Claim again
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const newBalance = await token.balanceOf(addr1.address);
            expect(newBalance).to.be.gt(initialBalance);
            
            const tracking = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(tracking.currentStreak).to.equal(2n);
        });

        it("Should apply streak bonus correctly", async function () {
            const initialBalance = await setupClaimTests(rewards, addr1, dailyConfig);

            // Claim again
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const balance = await token.balanceOf(addr1.address);
            const expectedBaseAmount = dailyConfig.baseAmount;
            const expectedBonus = expectedBaseAmount * BigInt(5) / BigInt(100); // 5% bonus
            expect(balance).to.equal(initialBalance + expectedBaseAmount + expectedBonus);
        });

        it("Should maintain streak when claiming anytime during the day", async function () {
            // Initial claim at midnight
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);
            
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Check initial streak
            let userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(1n);

            // Move to next day but stay within the same UTC day (12 hours later)
            await time.increase(dailyConfig.interval + 12 * 3600);

            // Should allow claiming and maintain streak
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Streak should be maintained since claiming on the correct day
            userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(2n); // Maintained streak
        });
    });

    describe("UTC Midnight Transitions", function () {
        it("Should correctly handle UTC midnight transitions with getStreakStatus", async function () {
            // First claim
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Get current timestamp and find next UTC midnight
            const currentTimestamp = await time.latest();
            const currentMidnight = Math.floor(currentTimestamp / 86400) * 86400;
            const nextMidnight = currentMidnight + 86400;
        
            // Move time to just before midnight
            await safeIncreaseTo(nextMidnight - 60); // 1 minute before midnight
            
            // Check status before midnight
            const statusBefore = await rewards.getStreakStatus(dailyRewardId, addr1.address);
            const canClaimBefore = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
            expect(statusBefore[3]).to.be.false;  // canClaim is the 4th field in StreakStatus
            expect(canClaimBefore).to.be.false;
        
            // Move time to just after midnight
            await safeIncreaseTo(nextMidnight + 60); // 1 minute after midnight
            
            // Check status after midnight
            const statusAfter = await rewards.getStreakStatus(dailyRewardId, addr1.address);
            const canClaimAfter = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
            expect(statusAfter[3]).to.be.true;  // canClaim is the 4th field
            expect(canClaimAfter).to.be.true;
            
            // Verify nextClaimTime is set to midnight
            expect(statusAfter[2]).to.equal(nextMidnight);  // nextClaimTime is 3rd field
        });
    
        it("Should maintain claim status anytime during the day after midnight", async function () {
            // First claim
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Move to next midnight
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);
            
            // Should be able to claim anytime during the day
            const status = await rewards.getStreakStatus(dailyRewardId, addr1.address);
            const canClaim = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
            expect(status[3]).to.be.true;  // canClaim is 4th field
            expect(canClaim).to.be.true;
        });
        
        it("Should maintain consistent state between getStreakStatus and isClaimingAllowed", async function () {
            // First claim
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Test at different times around midnight
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            
            const testTimes = [
                nextMidnight - 3600,    // 1 hour before midnight
                nextMidnight + 60,      // Just after midnight
            ];
        
            for (const testTime of testTimes) {
                await safeIncreaseTo(testTime);
                
                const status = await rewards.getStreakStatus(dailyRewardId, addr1.address);
                const canClaim = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
                
                // Status should be consistent between both methods
                expect(status[3]).to.equal(canClaim);  // canClaim is 4th field
            }
        });
    });

    describe("Protection System", function () {
        beforeEach(async function () {
            // Set timestamp to UTC midnight
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);

            // Build up required streak with daily claims
            for(let i = 0; i < 7; i++) {
                await rewards.connect(addr1).claim(dailyRewardId);
                
                // Move time forward one day
                await time.increase(86400);
            }

            // Approve tokens for protection purchase
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
        
        it("Should prevent protection purchase without required streak", async function () {
            await expect(rewards.connect(addr2).purchaseProtection(dailyRewardId, 0))
                .to.be.revertedWithCustomError(rewards, "InsufficientStreak");
        });

        it("Should prevent double protection purchase", async function () {
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 0);
            
            await expect(rewards.connect(addr1).purchaseProtection(dailyRewardId, 0))
                .to.be.revertedWithCustomError(rewards, "ProtectionAlreadyActive");
        });

        it("Should maintain streak when protected", async function () {
             // Configure a longer protection tier just for this test
            await rewards.configureProtectionTier(dailyRewardId, 0, {
                cost: ethers.parseUnits("50", 18),
                duration: 172800,                   // 2 days instead of 1
                requiredStreak: 7,
                enabled: true
            });

            // Purchase protection
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 0);
            
            const beforeInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            const currentTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
            expect(beforeInfo.protectionExpiry).to.be.gt(currentTimestamp);

            // Now we can safely move past the day
            await time.increase(86400);

            const isAllowed = await rewards.isClaimingAllowed(dailyRewardId, addr1.address);
            expect(isAllowed).to.be.true;
            
            await rewards.connect(addr1).claim(dailyRewardId);
            
            const userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(8n);
        });

        it("Should allow multiple late claims with 7-day protection", async function () {
            // Build 14-day streak to qualify for tier 2 protection
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);

            for(let i = 0; i < 14; i++) {
                await rewards.connect(addr1).claim(dailyRewardId);
                await time.increase(86400); // Move to next day
            }

            // Setup tokens for protection
            await token.transferAllocation(0, addr1.address, ethers.parseUnits("1000", 18));
            await token.connect(addr1).approve(await rewards.getAddress(), ethers.parseUnits("1000", 18));

            // Purchase 7-day protection (tier 2)
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 1);
            
            let userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(14n);
            const protectionExpiry = userInfo.protectionExpiry;

            // Make 3 consecutive late claims (outside grace period)
            for(let i = 0; i < 3; i++) {
                // Move to next day
                await time.increase(86400);
                
                // Should still be able to claim with protection
                expect(await rewards.isClaimingAllowed(dailyRewardId, addr1.address)).to.be.true;
                
                await rewards.connect(addr1).claim(dailyRewardId);
                
                userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
                expect(userInfo.currentStreak).to.equal(15n + BigInt(i)); // Streak continues
                
                // Protection should still be active (not consumed)
                expect(userInfo.protectionExpiry).to.equal(protectionExpiry);
            }
            
            // After 7 days, protection should expire naturally
            const remainingProtectionTime = Number(protectionExpiry) - await time.latest();
            await time.increase(remainingProtectionTime + 1);
            
            userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.protectionExpiry).to.be.lt(await time.latest()); // Expired
        });
    });

    describe("Multiple Day Skip Scenarios", function () {
        it("Should reset streak when skipping multiple days without protection", async function () {
            // Day 1: Initial claim (clean start, no beforeEach interference)
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);
            
            const initialBalance = await token.balanceOf(addr1.address);
            await rewards.connect(addr1).claim(dailyRewardId);
            
            // Verify first claim
            let userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(1n);
            const balanceAfterDay1 = await token.balanceOf(addr1.address);
            expect(balanceAfterDay1).to.equal(initialBalance + dailyConfig.baseAmount);

            // Skip multiple days (Day 2 and Day 3 entirely, claim on Day 4)
            // This simulates the real scenario: June 2 → June 4 (48+ hours later)
            const multipleDaysLater = 48 * 3600; // 48 hours = 2 full days
            await time.increase(multipleDaysLater);

            // Day 4: Claim after skipping multiple days
            const balanceBeforeDay4 = await token.balanceOf(addr1.address);
            await rewards.connect(addr1).claim(dailyRewardId);
            const balanceAfterDay4 = await token.balanceOf(addr1.address);

            // Verify streak was reset to 1 (no protection)
            userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(1n); // Should reset to 1
            
            // Verify reward amount reflects streak reset (base amount only, no bonus)
            const day4Reward = balanceAfterDay4 - balanceBeforeDay4;
            expect(day4Reward).to.equal(dailyConfig.baseAmount); // 10 TOTEM, no bonus

            // Day 5: Claim next day to verify normal progression
            await time.increase(86400); // Move to next day
            
            const balanceBeforeDay5 = await token.balanceOf(addr1.address);
            await rewards.connect(addr1).claim(dailyRewardId);
            const balanceAfterDay5 = await token.balanceOf(addr1.address);

            // Verify streak progressed from 1 to 2
            userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(2n);
            
            // Verify reward includes 5% bonus (streak 2)
            const day5Reward = balanceAfterDay5 - balanceBeforeDay5;
            const expectedDay5Reward = dailyConfig.baseAmount + (dailyConfig.baseAmount * BigInt(5) / BigInt(100));
            expect(day5Reward).to.equal(expectedDay5Reward); // 10.5 TOTEM
        });

        it("Should maintain streak when skipping multiple days WITH protection", async function () {
            // Build up a 14-day streak to qualify for 7-day protection (tier 1)
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);

            // Claim 14 days in a row to qualify for tier 1 protection
            for(let i = 0; i < 14; i++) {
                await rewards.connect(addr1).claim(dailyRewardId);
                if (i < 13) await time.increase(86400); // Don't advance time after last claim
            }

            // Setup tokens and purchase protection
            await token.transferAllocation(0, addr1.address, ethers.parseUnits("1000", 18));
            await token.connect(addr1).approve(await rewards.getAddress(), ethers.parseUnits("1000", 18));
            
            // Purchase 7-day protection (tier 1) - this can protect for multiple days
            await rewards.connect(addr1).purchaseProtection(dailyRewardId, 1);
            
            let userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(14n);
            
            // Verify protection is active
            const protectionExpiry = userInfo.protectionExpiry;
            const currentTime = await time.latest();
            expect(protectionExpiry).to.be.gt(currentTime);

            // Skip multiple days (2 days) while protected by 7-day protection
            await time.increase(48 * 3600); // 48 hours = 2 full days

            // Verify protection is still active before claiming
            const timeBeforeClaim = await time.latest();
            expect(protectionExpiry).to.be.gt(timeBeforeClaim);

            // Claim with protection active
            const balanceBefore = await token.balanceOf(addr1.address);
            await rewards.connect(addr1).claim(dailyRewardId);
            const balanceAfter = await token.balanceOf(addr1.address);

            // Verify streak was maintained due to protection
            userInfo = await rewards.getUserInfo(dailyRewardId, addr1.address);
            expect(userInfo.currentStreak).to.equal(15n); // Streak continues with protection
            
            // Verify reward includes streak bonus (calculated with streak 14, then incremented to 15)
            const reward = balanceAfter - balanceBefore;
            const expectedBonus = dailyConfig.baseAmount * BigInt(70) / BigInt(100); // 14 * 5% = 70%
            const expectedReward = dailyConfig.baseAmount + expectedBonus;
            expect(reward).to.equal(expectedReward); // 17.0 TOTEM
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