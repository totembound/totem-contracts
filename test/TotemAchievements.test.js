const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemAchievements", function () {
    let TotemAchievements, TotemToken, TotemProxy, TotemProxyAdmin;
    let achievements, token, proxy, proxyAdmin;
    let owner, addr1, addr2, authorizedContract;

    // Achievement test configurations
    const feedAchievementId = ethers.id("feed_achievement");
    const trainAchievementId = ethers.id("train_achievement");

    // Enum for Achievement Type
    const AchievementType = {
        EVOLUTION: 0,
        COLLECTION: 1,
        STREAK: 2,
        ACTION: 3
    };

    const achievementConfigs = [
        {
            id: "stage_1",
            name: "Novice Evolution",
            description: "Evolve a totem to stage 1",
            iconUri: "ipfs://stage1-icon",
            requirement: 1,
            achievementType: AchievementType.EVOLUTION,
            subType: ethers.id("evolution_stage")
        },
        {
            id: "stage_4",
            name: "Elder Evolution",
            description: "Evolve a totem to stage 4 - Unlocks Legendary rarity",
            iconUri: "ipfs://stage4-icon",
            requirement: 4,
            achievementType: AchievementType.EVOLUTION,
            subType: ethers.id("evolution_stage")
        },
        {
            id: "first_totem",
            name: "First Totem",
            description: "Mint your first NFT",
            iconUri: "ipfs://collection/first",
            requirement: 1,
            achievementType: AchievementType.COLLECTION,
            subType: ethers.id("mint_count")
        },
        {
            id: "rare_collector",
            name: "Rare Collector",
            description: "Own any Rare totem",
            iconUri: "ipfs://collection/rare",
            requirement: 1,
            achievementType: AchievementType.COLLECTION,
            subType: ethers.id("rarity_rare")
        },
        {
            id: "week_warrior",
            name: "Week Warrior",
            description: "Maintain a 7-day login streak",
            iconUri: "ipfs://streak/week",
            requirement: 7,
            achievementType: AchievementType.STREAK,
            subType: ethers.id("daily_login")
        },
        {
            id: "caring_keeper",
            name: "Caring Keeper",
            description: "Feed your totem 100 times",
            iconUri: "ipfs://action/feed",
            requirement: 100,
            achievementType: AchievementType.ACTION,
            subType: ethers.id("feed_count")
        }
    ];

    beforeEach(async function () {
        [owner, addr1, addr2, authorizedContract] = await ethers.getSigners();

        // Deploy mocks and setup contracts similar to deploy-local.ts
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        const oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));

        // Deploy Token
        const TotemToken = await ethers.getContractFactory("TotemToken");
        const tokenImpl = await TotemToken.deploy();

        // Deploy NFT
        TotemNFT = await ethers.getContractFactory("TotemNFT");
        nft = await TotemNFT.deploy();

        // Deploy Proxy Admin
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // Prepare token initialization
        const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
            await oracle.getAddress()
        ]);

        // Deploy Token Proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        const tokenProxy = await TotemProxy.deploy(
            await tokenImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initTokenData
        );

        // Get token interface
        token = await ethers.getContractAt("TotemToken", await tokenProxy.getAddress());

        // Deploy Achievements Implementation
        TotemAchievements = await ethers.getContractFactory("TotemAchievements");
        const achievementsImpl = await TotemAchievements.deploy();

        // Prepare achievements initialization
        const initData = TotemAchievements.interface.encodeFunctionData("initialize", []);

        // Deploy Achievements Proxy
        proxy = await TotemProxy.deploy(
            await achievementsImpl.getAddress(),
            owner.address,
            initData
        );

        // Get achievements contract interface
        achievements = await ethers.getContractAt("TotemAchievements", await proxy.getAddress());

        // Authorize a contract for progress updates
        await achievements.authorize(authorizedContract.address);
        await achievements.authorize(await nft.getAddress());
    });

    describe("Initialization", function () {
        it("Should configure all predefined achievements", async function () {
            // Configure all achievements
            for (const config of achievementConfigs) {
                await achievements.configureAchievement(
                    config.id,
                    config.name,
                    config.description,
                    config.iconUri,
                    config.requirement,
                    config.achievementType,
                    config.subType
                );
            }

            // Verify achievements were configured correctly
            const achievementIds = await achievements.getAchievementIds();
            expect(achievementIds.length).to.equal(achievementConfigs.length);

            // Check specific achievements
            const stageOneAchievement = await achievements.getAchievement(ethers.id("stage_1"));
            expect(stageOneAchievement.name).to.equal("Novice Evolution");
            expect(stageOneAchievement.requirement).to.equal(1n);

            const caringKeeperAchievement = await achievements.getAchievement(ethers.id("caring_keeper"));
            expect(caringKeeperAchievement.name).to.equal("Caring Keeper");
            expect(caringKeeperAchievement.requirement).to.equal(100n);
        });

        it("Should support different achievement types", async function () {
            const configTests = [
                { 
                    id: "stage_1", 
                    type: AchievementType.EVOLUTION, 
                    expectedSubType: ethers.id("evolution_stage") 
                },
                { 
                    id: "first_totem", 
                    type: AchievementType.COLLECTION, 
                    expectedSubType: ethers.id("mint_count") 
                },
                { 
                    id: "week_warrior", 
                    type: AchievementType.STREAK, 
                    expectedSubType: ethers.id("daily_login") 
                },
                { 
                    id: "caring_keeper", 
                    type: AchievementType.ACTION, 
                    expectedSubType: ethers.id("feed_count") 
                }
            ];

            for (const test of configTests) {
                await achievements.configureAchievement(
                    test.id,
                    `Test ${test.id}`,
                    "Test description",
                    "ipfs://test-icon",
                    10,
                    test.type,
                    test.expectedSubType
                );

                const achievement = await achievements.getAchievement(ethers.id(test.id));
                expect(achievement.achievementType).to.equal(test.type);
                expect(achievement.subType).to.equal(test.expectedSubType);
            }
        });
    });

    describe("Achievement Progress Tracking", function () {
        beforeEach(async function () {
            // Configure feed achievement
            await achievements.configureAchievement(
                "feed_achievement",
                "Feeding Master",
                "Feed your totem 10 times",
                "ipfs://feed-icon",
                10,
                AchievementType.ACTION,
                ethers.encodeBytes32String("feed")
            );
        });

        it("Should allow authorized contract to update progress", async function () {
            await achievements.connect(authorizedContract).updateProgress(
                feedAchievementId,
                addr1.address,
                5
            );

            const progress = await achievements.getProgress(feedAchievementId, addr1.address);
            expect(progress.count).to.equal(5n);
            expect(progress.achieved).to.be.false;
        });

        it("Should unlock achievement when requirement is met", async function () {
            await achievements.connect(authorizedContract).updateProgress(
                feedAchievementId,
                addr1.address,
                15
            );

            const progress = await achievements.getProgress(feedAchievementId, addr1.address);
            expect(progress.achieved).to.be.true;
            expect(await achievements.hasAchievement(feedAchievementId, addr1.address)).to.be.true;
        });

        it("Should prevent unauthorized contract from updating progress", async function () {
            await expect(
                achievements.updateProgress(
                    feedAchievementId,
                    addr1.address,
                    5
                )
            ).to.be.revertedWithCustomError(achievements, "UnauthorizedContract");
        });
    });

    describe("Direct Achievement Unlock", function () {
        beforeEach(async function () {
            // Configure an achievement for direct unlock
            await achievements.configureAchievement(
                "train_achievement",  // Changed from "evolution_achievement"
                "Training Champion",
                "Reach training milestone",
                "ipfs://train-icon",
                2,
                AchievementType.EVOLUTION,
                ethers.encodeBytes32String("train_stage")
            );
        });
    
        it("Should allow authorized contract to unlock achievement", async function () {
            await achievements.connect(authorizedContract).unlockAchievement(
                trainAchievementId,  // Use the pre-defined ID
                addr1.address,
                2
            );
    
            expect(await achievements.hasAchievement(trainAchievementId, addr1.address)).to.be.true;
        });
    
        it("Should prevent unlock if requirement is not met", async function () {
            await expect(
                achievements.connect(authorizedContract).unlockAchievement(
                    trainAchievementId,
                    addr1.address,
                    1
                )
            ).to.be.revertedWithCustomError(achievements, "RequirementNotMet");
        });
    });

    describe("Achievement Management", function () {
        beforeEach(async function () {
            // Configure multiple achievements
            await achievements.configureAchievement(
                "feed_achievement",
                "Feeding Master",
                "Feed your totem 10 times",
                "ipfs://feed-icon",
                10,
                AchievementType.ACTION,
                ethers.encodeBytes32String("feed")
            );

            await achievements.configureAchievement(
                "train_achievement",
                "Training Champion",
                "Train your totem 5 times",
                "ipfs://train-icon",
                5,
                AchievementType.ACTION,
                ethers.encodeBytes32String("train")
            );
        });

        it("Should return all achievement IDs", async function () {
            const ids = await achievements.getAchievementIds();
            expect(ids).to.have.lengthOf(2);
        });

        it("Should enable and disable achievements", async function () {
            const feedAchievement = feedAchievementId;
            
            // Disable achievement
            await achievements.disableAchievement(feedAchievement);
            const disabledAchievement = await achievements.getAchievement(feedAchievement);
            expect(disabledAchievement.enabled).to.be.false;

            // Enable achievement
            await achievements.enableAchievement(feedAchievement);
            const enabledAchievement = await achievements.getAchievement(feedAchievement);
            expect(enabledAchievement.enabled).to.be.true;
        });

        it("Should prevent actions on disabled achievements", async function () {
            const feedAchievement = feedAchievementId;
            
            // Disable achievement
            await achievements.disableAchievement(feedAchievement);

            // Try to update progress on disabled achievement
            await expect(
                achievements.connect(authorizedContract).updateProgress(
                    feedAchievement,
                    addr1.address,
                    5
                )
            ).to.be.revertedWithCustomError(achievements, "AchievementIsDisabled");
        });

        it("Should track highest stage unlocked", async function () {
            // Simulate unlocking multiple achievements with different requirements
            await achievements.connect(authorizedContract).unlockAchievement(
                feedAchievementId,
                addr1.address,
                15
            );

            await achievements.connect(authorizedContract).unlockAchievement(
                trainAchievementId,
                addr1.address,
                10
            );

            const highestStage = await achievements.getHighestStageUnlocked(addr1.address);
            expect(highestStage).to.equal(10n);
        });
    });

    describe("Metadata Management", function () {
        beforeEach(async function () {
            // Configure an achievement
            await achievements.configureAchievement(
                "feed_achievement",
                "Feeding Master",
                "Feed your totem 10 times",
                "ipfs://feed-icon",
                10,
                AchievementType.ACTION,
                ethers.encodeBytes32String("feed")
            );
        });

        it("Should allow setting metadata attributes", async function () {
            await achievements.setMetadataAttribute(
                feedAchievementId,
                "difficulty",
                "easy"
            );

            const value = await achievements.getMetadataAttribute(
                feedAchievementId,
                "difficulty"
            );
            expect(value).to.equal("easy");
        });

        it("Should prevent setting empty metadata key or value", async function () {
            await expect(
                achievements.setMetadataAttribute(
                    feedAchievementId,
                    "",
                    "value"
                )
            ).to.be.revertedWithCustomError(achievements, "InvalidMetadataKey");

            await expect(
                achievements.setMetadataAttribute(
                    feedAchievementId,
                    "key",
                    ""
                )
            ).to.be.revertedWithCustomError(achievements, "InvalidMetadataValue");
        });
    });
});
