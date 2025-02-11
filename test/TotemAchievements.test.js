const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemAchievements", function () {
    let TotemAchievements, TotemToken, TotemProxy, TotemProxyAdmin;
    let achievements, token, proxy, proxyAdmin;
    let owner, addr1, addr2, authorizedContract;

    // Achievement test configurations
    const feedAchievementId = ethers.id("feed_achievement");
    const trainAchievementId = ethers.id("train_achievement");

    const AchievementCategory = {
        Evolution: 0,      // Stage based
        Collection: 1,     // NFT ownership based
        Streak: 2,         // Time consistency based
        Action: 3          // Game action based
    };

    const AchievementType = {
        OneTime: 0,        // Single unlock with badge
        Progression: 1     // Multiple milestones with badges
    };

    const achievementConfigs = [
        {
            id: "rare_evolution",
            name: "Rare Elder Evolution",
            description: "Evolve a Rare totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/rare",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "epic_evolution",
            name: "Epic Elder Evolution",
            description: "Evolve an Epic totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/epic",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "legendary_evolution",
            name: "Legendary Elder Evolution",
            description: "Evolve a Legendary totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/legendary",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "evolution_progression",
            name: "Evolution Mastery",
            description: "Master the art of evolving your Totem through different stages",
            category: AchievementCategory.Evolution,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("evolution"),
            milestones: [
                {
                    name: "First Evolution",
                    description: "Evolve your first totem to stage 1",
                    badgeUri: "ipfs://badge/evolution/stage1",
                    requirement: 1
                },
                {
                    name: "Adept Evolution",
                    description: "Evolve a totem to stage 2",
                    badgeUri: "ipfs://badge/evolution/stage2",
                    requirement: 2
                },
                {
                    name: "Master Evolution",
                    description: "Evolve a totem to stage 3 - Unlocks Epic rarity",
                    badgeUri: "ipfs://badge/evolution/stage3",
                    requirement: 3
                },
                {
                    name: "Elder Evolution",
                    description: "Evolve a totem to stage 4 - Unlocks Legendary rarity",
                    badgeUri: "ipfs://badge/evolution/stage4",
                    requirement: 4
                }
            ]
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
                const achievementConfig = {
                    idString: config.id,
                    name: config.name,
                    description: config.description,
                    category: config.category,
                    achievementType: config.type,
                    badgeUri: config.badgeUri,
                    subType: config.subType,
                    milestones: config.milestones,
                    requirements: []
                };
            
                await achievements.configureAchievement(achievementConfig);
            }

            // Verify achievements were configured correctly
            const achievementIds = await achievements.getAchievementIds();
            expect(achievementIds.length).to.equal(achievementConfigs.length);

            // Check specific achievements
            const stageOneAchievement = await achievements.getAchievement(ethers.id("rare_evolution"));
            expect(stageOneAchievement.name).to.equal("Rare Elder Evolution");
            //expect(stageOneAchievement.requirement).to.equal(1n);

            const caringKeeperAchievement = await achievements.getAchievement(ethers.id("evolution_progression"));
            expect(caringKeeperAchievement.name).to.equal("Evolution Mastery");
            //expect(caringKeeperAchievement.requirement).to.equal(100n);
        });


        it("Should support different achievement types", async function () {
            const configTests = [
                { 
                    id: "stage_1", 
                    type: AchievementType.OneTime, 
                    category: AchievementCategory.Evolution,
                    expectedSubType: ethers.id("evolution_stage"),
                    milestones: []
                },
                { 
                    id: "first_totem", 
                    type: AchievementType.OneTime, 
                    category: AchievementCategory.Collection,
                    expectedSubType: ethers.id("mint_count"),
                    milestones: []
                },
                { 
                    id: "week_warrior", 
                    type: AchievementType.Progression, 
                    category: AchievementCategory.Streak,
                    expectedSubType: ethers.id("daily_login"),
                    milestones: [{
                        name: "First Evolution",
                        description: "Evolve your first totem to stage 1",
                        badgeUri: "ipfs://badge/evolution/stage1",
                        requirement: 1
                    }]
                },
                { 
                    id: "caring_keeper", 
                    type: AchievementType.Progression, 
                    category: AchievementCategory.Action,
                    expectedSubType: ethers.id("feed_count"),
                    milestones: [{
                        name: "First Evolution",
                        description: "Evolve your first totem to stage 1",
                        badgeUri: "ipfs://badge/evolution/stage1",
                        requirement: 1
                    }]
                }
            ];

            for (const test of configTests) {
                const achievementConfig = {
                    idString: test.id,
                    name: `Test ${test.id}`,
                    description: "Test description",
                    category: test.category,
                    achievementType: test.type,
                    badgeUri: "ipfs://badge",
                    subType: test.expectedSubType,
                    milestones: test.milestones,
                    requirements: []
                };

                await achievements.configureAchievement(achievementConfig);

                const achievement = await achievements.getAchievement(ethers.id(test.id));
                expect(achievement.achievementType).to.equal(test.type);
                expect(achievement.subType).to.equal(test.expectedSubType);
            }
        });
    });

    describe("Achievement Progress Tracking", function () {
        beforeEach(async function () {
            // Configure feed achievement
            await achievements.configureAchievement({
                idString: "feed_achievement",
                name: "Feeding Master",
                description: "Feed your totem 10 times",
                category: AchievementCategory.Action,
                achievementType: AchievementType.Progression,
                badgeUri: "ipfs://feed-icon",
                subType: ethers.id("feed_count"),
                milestones: [{
                    name: "Caring Keeper",
                    description: "Feed your totem 100 times",
                    badgeUri: "ipfs://action/feed/100",
                    requirement: 100,
                }],
                requirements: []
            });
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
                100
            );

            const progress = await achievements.getAchievementProgress(feedAchievementId, addr1.address);
            expect(progress[1]).to.equal(100n);
            expect(progress[2][0]).to.be.true;
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

    describe("Evolution Progress Tracking", function () {
        const evolutionProgressId = ethers.id("evolution_progression");
        
        beforeEach(async function () {
            // Configure evolution progression achievement
            await achievements.configureAchievement({
                idString: "evolution_progression",
                name: "Evolution Mastery",
                description: "Master the art of evolving your Totem through different stages",
                category: AchievementCategory.Evolution,
                achievementType: AchievementType.Progression,
                badgeUri: "",
                subType: ethers.id("evolution"),
                milestones: [
                    {
                        name: "First Evolution",
                        description: "Evolve your first totem to stage 1",
                        badgeUri: "ipfs://badge/evolution/stage1",
                        requirement: 1
                    },
                    {
                        name: "Adept Evolution",
                        description: "Evolve a totem to stage 2",
                        badgeUri: "ipfs://badge/evolution/stage2",
                        requirement: 2
                    },
                    {
                        name: "Master Evolution",
                        description: "Evolve a totem to stage 3",
                        badgeUri: "ipfs://badge/evolution/stage3",
                        requirement: 3
                    },
                    {
                        name: "Elder Evolution",
                        description: "Evolve a totem to stage 4",
                        badgeUri: "ipfs://badge/evolution/stage4",
                        requirement: 4
                    }
                ],
                requirements: []
            });
        });
    
        it("Should increment progress only on first time reaching each stage", async function () {
            // First totem reaches stage 1
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            let progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(1n);
            expect(progress.unlockedMilestones[0]).to.be.true;
            expect(progress.unlockedMilestones[1]).to.be.false;
    
            // Second totem reaches stage 1 - should not increment
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(1n); // Still 1
            expect(progress.unlockedMilestones[0]).to.be.true;
    
            // First totem reaches stage 2
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 2);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(2n);
            expect(progress.unlockedMilestones[1]).to.be.true;
    
            // Another totem reaches stage 2 - should not increment
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 2);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(2n); // Still 2
        });
    
        it("Should track progression all the way to Elder stage", async function () {
            // Progress through all stages
            for (let stage = 1; stage <= 4; stage++) {
                await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, stage);
                const progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
                expect(progress.count).to.equal(BigInt(stage));
                
                // Check all milestones up to current stage are unlocked
                for (let i = 0; i < stage; i++) {
                    expect(progress.unlockedMilestones[i]).to.be.true;
                }
                // Check remaining milestones are still locked
                for (let i = stage; i < 4; i++) {
                    expect(progress.unlockedMilestones[i]).to.be.false;
                }
            }
        });
    
        it("Should prevent unauthorized contracts from updating evolution progress", async function () {
            await expect(
                achievements.connect(addr1).updateEvolutionProgress(addr1.address, 1)
            ).to.be.revertedWithCustomError(achievements, "UnauthorizedContract");
        });
    
        it("Should require achievement to be enabled", async function () {
            // Disable the achievement
            await achievements.disableAchievement(evolutionProgressId);
    
            await expect(
                achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1)
            ).to.be.revertedWithCustomError(achievements, "AchievementIsDisabled");
        });
    
        it("Should handle stage progression correctly", async function () {
            // Reach stage 1
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            let progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(1n);
            expect(progress.unlockedMilestones[0]).to.be.true;
        
            // Reach stage 2
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 2);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(2n);
            expect(progress.unlockedMilestones[0]).to.be.true;
            expect(progress.unlockedMilestones[1]).to.be.true;
        
            // Reach stage 3
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 3);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(3n);
            expect(progress.unlockedMilestones[0]).to.be.true;
            expect(progress.unlockedMilestones[1]).to.be.true;
            expect(progress.unlockedMilestones[2]).to.be.true;
        });
        
        it("Should handle multiple totems reaching same stage", async function () {
            // First totem reaches stage 1
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            let progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(1n);
            expect(progress.unlockedMilestones[0]).to.be.true;
        
            // Second totem reaches stage 1 - should not increment
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            progress = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress.count).to.equal(1n); // Still 1
            expect(progress.unlockedMilestones[0]).to.be.true;
        });
        
        it("Should track stage progress separately for different users", async function () {
            // First user progresses through stages sequentially (as required by game)
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 1);
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr1.address, 2);
            let progress1 = await achievements.getDetailedProgress(evolutionProgressId, addr1.address);
            expect(progress1.count).to.equal(2n);
            expect(progress1.unlockedMilestones[0]).to.be.true; // Stage 1 unlocked
            expect(progress1.unlockedMilestones[1]).to.be.true; // Stage 2 unlocked
        
            // Second user reaches stage 1
            await achievements.connect(authorizedContract).updateEvolutionProgress(addr2.address, 1);
            let progress2 = await achievements.getDetailedProgress(evolutionProgressId, addr2.address);
            expect(progress2.count).to.equal(1n);
            expect(progress2.unlockedMilestones[0]).to.be.true;
            expect(progress2.unlockedMilestones[1]).to.be.false;
        });
    });

    describe("Direct Achievement Unlock", function () {
        beforeEach(async function () {
            // Configure an achievement for direct unlock
            await achievements.configureAchievement({
                idString: "train_achievement",
                name: "Training Champion",
                description: "Reach training milestone",
                category: AchievementCategory.Evolution,
                achievementType: AchievementType.OneTime,
                badgeUri: "ipfs://train-icon",
                subType: ethers.id("train_strage"),
                milestones: [],
                requirements: []
            });
        });
    
        it("Should allow authorized contract to unlock achievement", async function () {
            await achievements.connect(authorizedContract).unlockAchievement(
                trainAchievementId,
                addr1.address
            );
    
            expect(await achievements.hasAchievement(trainAchievementId, addr1.address)).to.be.true;
        });
    
        it("Should prevent unauthorized callers from unlocking achievement", async function () {
            await expect(
                achievements.connect(addr1).unlockAchievement(
                    trainAchievementId,
                    addr1.address
                )
            ).to.be.revertedWithCustomError(achievements, "UnauthorizedContract");
        });
    });

    describe("Achievement Management", function () {
        beforeEach(async function () {
            // Configure multiple achievements
            await achievements.configureAchievement({
                idString: "feed_achievement",
                name: "Feeding Master",
                description: "Feed your totem 10 times",
                category: AchievementCategory.Action,
                achievementType: AchievementType.Progression,
                badgeUri: "ipfs://feed-icon",
                subType: ethers.id("feed"),
                milestones: [{
                    name: "First Feed",
                    description: "Feed milestone",
                    badgeUri: "ipfs://feed/1",
                    requirement: 100
                }],
                requirements: []
            });

            await achievements.configureAchievement({
                idString: "train_achievement",
                name: "Training Champion",
                description: "Train your totem 5 times",
                category: AchievementCategory.Action,
                achievementType: AchievementType.Progression,
                badgeUri: "ipfs://train-icon",
                subType: ethers.id("train"),
                milestones: [{
                    name: "First Train",
                    description: "Train milestone",
                    badgeUri: "ipfs://train/1",
                    requirement: 100
                }],
                requirements: []
            });
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
            expect(disabledAchievement[6]).to.be.false; // enabled is the 7th return value

            // Enable achievement
            await achievements.enableAchievement(feedAchievement);
            const enabledAchievement = await achievements.getAchievement(feedAchievement);
            expect(enabledAchievement[6]).to.be.true; // enabled is the 7th return value
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

        it("Should track progression milestones", async function () {
            // Configure a progression achievement with multiple milestones
            await achievements.configureAchievement({
                idString: "progression_test",
                name: "Progression Test",
                description: "Test progression tracking",
                category: AchievementCategory.Evolution,
                achievementType: AchievementType.Progression,
                badgeUri: "",
                subType: ethers.id("progression"),
                milestones: [
                    {
                        name: "First Milestone",
                        description: "Reach first milestone",
                        badgeUri: "ipfs://milestone/1",
                        requirement: 5
                    },
                    {
                        name: "Second Milestone",
                        description: "Reach second milestone",
                        badgeUri: "ipfs://milestone/2",
                        requirement: 10
                    },
                    {
                        name: "Final Milestone",
                        description: "Reach final milestone",
                        badgeUri: "ipfs://milestone/3",
                        requirement: 15
                    }
                ],
                requirements: []
            });

            const achievementId = ethers.id("progression_test");

            // Update progress and check milestones
            await achievements.connect(authorizedContract).updateProgress(
                achievementId,
                addr1.address,
                7  // Should unlock first milestone
            );

            let progress = await achievements.getDetailedProgress(achievementId, addr1.address);
            expect(progress.unlockedMilestones[0]).to.be.true;
            expect(progress.unlockedMilestones[1]).to.be.false;
            expect(progress.unlockedMilestones[2]).to.be.false;

            // Update to reach second milestone
            await achievements.connect(authorizedContract).updateProgress(
                achievementId,
                addr1.address,
                5  // Total now 12, should unlock second milestone
            );

            progress = await achievements.getDetailedProgress(achievementId, addr1.address);
            expect(progress.unlockedMilestones[0]).to.be.true;
            expect(progress.unlockedMilestones[1]).to.be.true;
            expect(progress.unlockedMilestones[2]).to.be.false;
            expect(progress.count).to.equal(12n);
        });
    });

    describe("Metadata Management", function () {
        beforeEach(async function () {
            // Configure an achievement
            await achievements.configureAchievement({
                idString: "feed_achievement",
                name: "Feeding Master",
                description: "Feed your totem 10 times",
                category: AchievementCategory.Action,
                achievementType: AchievementType.Progression,
                badgeUri: "ipfs://feed-icon",
                subType: ethers.id("feed"),
                milestones: [{
                    name: "First Feed",
                    description: "Feed milestone",
                    badgeUri: "ipfs://feed/1",
                    requirement: 100
                }],
                requirements: []
            });
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
