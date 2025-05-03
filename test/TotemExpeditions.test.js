const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { safeIncreaseTo } = require('./timeHelpers');

describe("TotemExpeditions", function () {
    let TotemGame, TotemToken, TotemNFT, TotemProxy, TotemExpeditions, TotemAchievements, TotemShop;
    let game, token, nft, expeditions, achievements, shop;
    let owner, addr1, addr2, trustedForwarder, randomOracle;
    let expPerTraining = 1000;
    let totemIds; // Array to track minted totems
    
    // Initial game parameters
    const gameParams = {
        signupReward: ethers.parseUnits("5000", 18),   // 5000 TOTEM
        mintPrice: ethers.parseUnits("500", 18)        // 500 TOTEM
    };

    // Time windows for feeding (in seconds from start of day UTC)
    const timeWindows = {
        window1Start: 0n,      // 00:00 UTC
        window2Start: 28800n,  // 08:00 UTC
        window3Start: 57600n   // 16:00 UTC
    };

    // Domain enum values from contract
    const Domain = {
        Air: 0,
        Earth: 1,
        Water: 2
    };

    // Sample expedition configuration
    const expeditionConfig = {
        idString: "forest_exploration",
        name: "Forest Exploration",
        domain: Domain.Earth,
        duration: 3600, // 1 hour duration for testing
        totemCost: ethers.parseUnits("100", 18),
        happinessCost: 10,
        baseExperience: 100,
        affinityWeights: [7, 5, 3], // [Strength, Agility, Wisdom]
        runeDropChances: [50, 25, 5], // [Lesser, Greater, Ancient]
        minStage: 2
    };

    // Sample expedition configuration
    const expeditionConfig2 = {
        idString: "forest_exploration2",
        name: "Forest Exploration2",
        domain: Domain.Earth,
        duration: 3600, // 1 hour duration for testing
        totemCost: ethers.parseUnits("100", 18),
        happinessCost: 10,
        baseExperience: 100,
        affinityWeights: [7, 5, 3], // [Strength, Agility, Wisdom]
        runeDropChances: [50, 25, 5], // [Lesser, Greater, Ancient]
        minStage: 2
    };

    beforeEach(async function () {
        [owner, addr1, addr2, trustedForwarder] = await ethers.getSigners();
        totemIds = []; // Reset totem IDs array

        // Deploy mock random oracle first
        const MockRandomOracle = await ethers.getContractFactory("MockRandomOracle");
        randomOracle = await MockRandomOracle.deploy();

        // Deploy price oracle
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        const oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));

        // Deploy implementation
        TotemToken = await ethers.getContractFactory("TotemToken");
        const tokenImpl = await TotemToken.deploy();

        // Deploy proxy admin
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        const proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // Prepare initialization data
        const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
            await oracle.getAddress(),
            trustedForwarder.address
        ]);

        // Deploy proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        const tokenProxy = await TotemProxy.deploy(
            await tokenImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initTokenData
        );

        // Get token interface at proxy address
        token = await ethers.getContractAt("TotemToken", await tokenProxy.getAddress());

        // Deploy TotemNFT
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

        // Set up random oracle for NFT
        await nft.setRandomOracle(await randomOracle.getAddress());

        // Set up valid color mappings
        await nft.setValidColorsForRarities(
            [0, 0, 0, 0,   // Common
             1, 1, 1, 1,   // Uncommon
             2, 2, 2,      // Rare
             3, 3, 3,      // Epic
             4, 4],        // Legendary
            [0, 1, 2, 3,   // Common -> Brown, Gray, White, Tawny
             4, 5, 6, 7,   // Uncommon -> Slate, Copper, Cream, Dappled
             8, 9, 10,     // Rare -> Golden, DarkPurple, Charcoal
             11, 12, 13,   // Epic -> EmeraldGreen, CrimsonRed, DeepSapphire
             14, 15]       // Legendary -> RadiantGold, EtherealSilver
        );

        // Deploy Achievements
        TotemAchievements = await ethers.getContractFactory("TotemAchievements");
        const achievementsImpl = await TotemAchievements.deploy();
        const initAchievementsData = TotemAchievements.interface.encodeFunctionData("initialize", []);
        const achievementsProxy = await TotemProxy.deploy(
            await achievementsImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initAchievementsData
        );
        achievements = await ethers.getContractAt("TotemAchievements", await achievementsProxy.getAddress());

        // Deploy Game Implementation and Proxy
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

        // Deploy Shop Implementation and Proxy (required for authorization)
        TotemShop = await ethers.getContractFactory("TotemShop");
        const shopImpl = await TotemShop.deploy();

        const initShopData = TotemShop.interface.encodeFunctionData("initialize", [
            await game.getAddress(),
            await token.getAddress(),
            await nft.getAddress(),
            trustedForwarder.address
        ]);

        const shopProxy = await TotemProxy.deploy(
            await shopImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initShopData
        );
        shop = await ethers.getContractAt("TotemShop", await shopProxy.getAddress());
        
        // Set shop as authorized in game
        await game.setAuthorizedShop(await shop.getAddress());

        // Deploy Expeditions
        TotemExpeditions = await ethers.getContractFactory("TotemExpeditions");
        const expeditionsImpl = await TotemExpeditions.deploy();

        const initExpData = TotemExpeditions.interface.encodeFunctionData("initialize", [
            await game.getAddress(),
            await token.getAddress(),
            await nft.getAddress(),
            trustedForwarder.address
        ]);

        const expeditionsProxy = await TotemProxy.deploy(
            await expeditionsImpl.getAddress(), 
            await proxyAdmin.getAddress(), 
            initExpData
        );
        expeditions = await ethers.getContractAt("TotemExpeditions", await expeditionsProxy.getAddress());

        // Set expeditions in game
        await game.setExpeditions(await expeditions.getAddress());
        
        // Set achievements in game and expeditions
        await game.setAchievements(await achievements.getAddress());
        await expeditions.setAchievements(await achievements.getAddress());
        
        // Authorize the expeditions contract in achievements
        await achievements.authorize(await expeditions.getAddress());
        await achievements.authorize(await nft.getAddress());
        await achievements.authorize(await game.getAddress());

        // Transfer token allocation to game contract
        await token.transferAllocation(
            0, // Game category
            await game.getAddress(),
            ethers.parseUnits("250000000", 18) // 250M tokens
        );

        await achievements.configureAchievement({
            idString: "expedition_progression",
            name: "Expedition Master",
            description: "Complete multiple expeditions",
            category: 3, // Action
            achievementType: 1, // Progression
            badgeUri: "ipfs://expedition-icon",
            subType: ethers.id("expedition_count"),
            milestones: [{
                name: "Expedition Explorer",
                description: "Complete 10 expeditions",
                badgeUri: "ipfs://action/expedition/10",
                requirement: 10,
            }],
            requirements: []
        });

        await achievements.configureAchievement({
            idString: "train_progression",
            name: "Training Master",
            description: "Master the art of training your Totem",
            category: 3, // Action
            achievementType: 1, // Progression
            badgeUri: "ipfs://expedition-icon",
            subType: ethers.id("train_count"),
            milestones: [                {
                name: "Aspiring Trainer",
                description: "Train your totem 100 times",
                badgeUri: "ipfs://badge/action/train/100",
                requirement: 100,
            }],
            requirements: []
        });

        // Transfer NFT ownership to game contract
        await nft.transferOwnership(await game.getAddress());

        // Configure expeditions
        await expeditions.configureExpedition(
            expeditionConfig.idString,
            expeditionConfig.name,
            expeditionConfig.domain,
            expeditionConfig.duration,
            expeditionConfig.totemCost,
            expeditionConfig.happinessCost,
            expeditionConfig.baseExperience,
            expeditionConfig.affinityWeights,
            expeditionConfig.runeDropChances,
            expeditionConfig.minStage
        );
        await expeditions.configureExpedition(
            expeditionConfig2.idString,
            expeditionConfig2.name,
            expeditionConfig2.domain,
            expeditionConfig2.duration,
            expeditionConfig2.totemCost,
            expeditionConfig2.happinessCost,
            expeditionConfig2.baseExperience,
            expeditionConfig2.affinityWeights,
            expeditionConfig2.runeDropChances,
            expeditionConfig2.minStage
        );

        await game.updateActionConfig(1, { // Train
            cost: ethers.parseUnits("10", 18),
            cooldown: 0,
            maxDaily: 100, // High limit for testing
            minHappiness: 0,
            happinessChange: 10,
            experienceGain: expPerTraining, // High XP gain to speed up testing
            useTimeWindows: false,
            increasesHappiness: true, // Increase happiness to avoid issues
            enabled: true
        });
    });

    // Helper function to prepare a team of totems for expedition
    async function prepareTotemTeam(user, speciesArray, evolveToStage = 2) {
        // Sign up if not already
        if (!(await game.hasSignedUp(user.address))) {
            await game.connect(user).signup();
        }

        // Approve tokens for mint and actions
        const totalApproval = ethers.parseUnits("50000", 18); // Generous approval for all operations
        await token.connect(user).approve(await game.getAddress(), totalApproval);

        // Create array to store token IDs
        const teamIds = [];

         // Get initial token count to properly track new tokens
        const initialTokenCount = await nft.balanceOf(user.address);

        // Mint totems
        for (let i = 0; i < speciesArray.length; i++) {
            const species = speciesArray[i];
            // Purchase totem through the shop (which is authorized)
            await shop.connect(user).purchaseTotem(species);

            const tokenIndex = Number(initialTokenCount) + i;

            // Get the token ID
            const tokenId = await nft.tokenOfOwnerByIndex(user.address, tokenIndex);
            teamIds.push(tokenId);

            // Get the assigned attributes 
            tokenAttrs = await nft.attributes(tokenId);
            
            // CRITICAL: Set metadata URIs for ALL stages before testing
            for (let stage = 0; stage < 5; stage++) {
                await game.setMetadataURI(
                    tokenAttrs.species,
                    tokenAttrs.color,
                    stage,
                    `ipfs://test-hash-stage-${stage}`
                );
            }
            
            // Evolve if needed
            if (evolveToStage > 0) {
                // Loop for each stage we need to evolve through
                for (let targetStage = 1; targetStage <= evolveToStage; targetStage++) {
                    // Get current attributes
                    let currentAttrs = await nft.attributes(tokenId);
                    const currentStage = Number(currentAttrs.stage);
                    
                    // Skip if already at or beyond target stage
                    if (currentStage >= targetStage) {
                        continue;
                    }
                    
                    // Get the threshold for this stage
                    const expThreshold = await nft.stageThresholds(currentStage);
                    const currentExp = currentAttrs.experience;
                    
                    // Calculate how many training sessions we need (1000 exp per train from the test setup)
                    const expPerTraining = 1000; 
                    const sessionsNeeded = Math.ceil((Number(expThreshold) - Number(currentExp)) / expPerTraining) + 1; // Add 1 for safety
                    
                    // Train enough times to reach the threshold
                    for (let j = 0; j < sessionsNeeded; j++) {
                        await game.connect(user).train(tokenId);
                        
                        // Check if we've reached the threshold
                        currentAttrs = await nft.attributes(tokenId);
                        if (Number(currentAttrs.experience) >= Number(expThreshold)) {
                            break; // Stop training if we've reached the threshold
                        }
                    }
                    
                    // Now we should have enough experience to evolve
                    await nft.connect(user).evolve(tokenId);
                    
                    // Verify we evolved to the next stage
                    currentAttrs = await nft.attributes(tokenId);
                    if (Number(currentAttrs.stage) !== targetStage) {
                        throw new Error(`Failed to evolve to stage ${targetStage}. Current stage: ${currentAttrs.stage}`);
                    }
                }
                
                // Final verification - explicitly convert to Number for comparison
                const finalAttrs = await nft.attributes(tokenId);
                const finalStage = Number(finalAttrs.stage);
                
                // This is where the error is happening - we need to ensure proper conversion
                expect(finalStage).to.equal(evolveToStage);
            }
        }
        
        return teamIds;
    }

    describe("Initialization", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await expeditions.totemToken()).to.equal(await token.getAddress());
            expect(await expeditions.totemNFT()).to.equal(await nft.getAddress());
            expect(await expeditions.trustedForwarder()).to.equal(trustedForwarder.address);
            expect(await expeditions.game()).to.equal(await game.getAddress());
        });

        it("Should have expedition properly configured", async function () {
            const expeditionId = ethers.id(expeditionConfig.idString);
            const expeditionIds = await expeditions.getExpeditions();
            expect(expeditionIds.length).to.equal(2);
            
            const config = await expeditions.getExpeditionConfig(expeditionId);
            expect(config.name).to.equal(expeditionConfig.name);
            expect(config.domain).to.equal(expeditionConfig.domain);
            expect(config.duration).to.equal(expeditionConfig.duration);
            expect(config.totemCost).to.equal(expeditionConfig.totemCost);
            expect(config.happinessCost).to.equal(expeditionConfig.happinessCost);
            expect(config.baseExperience).to.equal(expeditionConfig.baseExperience);
            expect(config.enabled).to.be.true;
        });
    });

    describe("Expedition Management", function () {
        it("Should allow configuring a new expedition", async function () {
            await expeditions.configureExpedition(
                "water_expedition",
                "Deep Ocean Exploration",
                Domain.Water,
                7200, // 2 hours
                ethers.parseUnits("200", 18),
                15,
                150,
                [3, 8, 5], // Different affinity weights
                [60, 30, 10],
                2
            );
            
            const expeditionId = ethers.id("water_expedition");
            const config = await expeditions.getExpeditionConfig(expeditionId);
            
            expect(config.name).to.equal("Deep Ocean Exploration");
            expect(config.domain).to.equal(Domain.Water);
            expect(config.duration).to.equal(7200);
            expect(config.totemCost).to.equal(ethers.parseUnits("200", 18));
            expect(config.baseExperience).to.equal(150);
        });

        it("Should manage multiple different expedition types concurrently", async function() {
            // Create multiple teams for different expeditions
            const landTeam = await prepareTotemTeam(addr1, [2, 8, 5], 2); // Wolf, Bear, Deer for land
            const waterTeam = await prepareTotemTeam(addr1, [2, 0, 4], 2); // Wolf, Goose, Beaver for land captain
            const airTeam = await prepareTotemTeam(addr1, [9, 11, 7], 2); // Falcon, Raven, Owl for air
            
            // Configure expeditions for each domain if not already configured
            const expeditionId = ethers.id(expeditionConfig.idString);
            const expeditionId2 = ethers.id(expeditionConfig2.idString);
            const expeditionId3 = ethers.id("air_exp_for_air_team");
            await expeditions.configureExpedition(
              "air_exp_for_air_team",
              "Air Expedition",
              Domain.Air,
              expeditionConfig.duration,
              expeditionConfig.totemCost,
              expeditionConfig.happinessCost,
              expeditionConfig.baseExperience,
              expeditionConfig.affinityWeights,
              expeditionConfig.runeDropChances,
              expeditionConfig.minStage
            );
          
            // Approve token spending
            await token.connect(addr1).approve(
              await game.getAddress(),
              ethers.parseUnits("50000", 18)
            );
            
            // Start all three expeditions
            await expeditions.connect(addr1).startExpedition(expeditionId, landTeam);
            await expeditions.connect(addr1).startExpedition(expeditionId2, waterTeam);
            await expeditions.connect(addr1).startExpedition(expeditionId3, airTeam);
            
            // Check active expeditions
            const activeExps = await expeditions.getUserActiveExpeditions(addr1.address);
            expect(activeExps.ids.length).to.equal(3);
            
            // Fast forward and complete all
            await time.increase(expeditionConfig.duration + 60);
            
            // Claim rewards for all
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId);
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId2);
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId3);
            
            // Verify all completed
            const userExps = await expeditions.getUserExpeditions(addr1.address);
            expect(userExps.completed.filter(c => c).length).to.equal(3);
        });

        it("Should fail to configure expedition with invalid parameters", async function () {
            // Test with invalid domain (out of range)
            await expect(expeditions.configureExpedition(
                "invalid_expedition",
                "Invalid Domain",
                5, // Invalid domain (only 0-4 valid)
                3600,
                ethers.parseUnits("100", 18),
                10,
                100,
                [5, 5, 5],
                [25, 25, 5],
                2
            )).to.be.reverted; // Any revert is fine here
        });
    });

    describe("Starting Expeditions", function () {
        let expeditionId;
        let expeditionId2;
        let landTeamIds;

        beforeEach(async function () {
            expeditionId = ethers.id(expeditionConfig.idString);
            expeditionId2 = ethers.id(expeditionConfig2.idString);

            // Prepare land-domain team (Wolf, Bear, Deer - all land domain)
            landTeamIds = await prepareTotemTeam(addr1, [2, 8, 5], 2);
        });

        it("Should allow starting an expedition with valid team", async function () {
            // Approve tokens for expedition cost
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Check initial expedition state
            const initialActive = await expeditions.getUserActiveExpeditions(addr1.address);
            expect(initialActive.ids.length).to.equal(0);

            // Start expedition
            await expeditions.connect(addr1).startExpedition(expeditionId, [landTeamIds[0], landTeamIds[1], landTeamIds[2]]);
            
            // Check active expeditions
            const activeExpeditions = await expeditions.getUserActiveExpeditions(addr1.address);
            expect(activeExpeditions.ids.length).to.equal(1);
            expect(activeExpeditions.ids[0]).to.equal(expeditionId);
            
            // Check totem status
            for (const tokenId of landTeamIds) {
                const [isOnExpedition, endTime] = await expeditions.isTotemOnExpedition(tokenId);
                expect(isOnExpedition).to.be.true;
                expect(endTime).to.be.gt(0);
            }
        });

        it("Should accept totems at exact minimum stage requirement", async function() {
            // Create team at exactly minimum stage
            const minStageTeam = await prepareTotemTeam(addr1, [2, 8, 5], expeditionConfig.minStage);
            
            await token.connect(addr1).approve(
              await game.getAddress(),
              expeditionConfig.totemCost
            );
            
            // This should succeed
            await expeditions.connect(addr1).startExpedition(expeditionId, minStageTeam);
            
            // Verify expedition started
            const activeExps = await expeditions.getUserActiveExpeditions(addr1.address);
            expect(activeExps.ids.length).to.be.greaterThan(0);
        });

        it("Should fail with incorrect captain domain", async function () {
            // Create a water domain team with Otter as captain (wrong domain for forest expedition)
            const waterTeamIds = await prepareTotemTeam(addr1, [1, 8, 5], 2); // Otter (water), Bear, Deer
            
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Attempt expedition with incorrect domain captain
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [waterTeamIds[0], waterTeamIds[1], waterTeamIds[2]]
            )).to.be.revertedWithCustomError(expeditions, "InvalidCaptainDomain");
        });

        it("Should fail if team members have insufficient stage", async function () {
            // Create team with insufficient stage (stage 1 instead of required 2)
            const lowStageTeamIds = await prepareTotemTeam(addr1, [2, 8, 5], 1);
            
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Attempt expedition with low stage
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [lowStageTeamIds[0], lowStageTeamIds[1], lowStageTeamIds[2]]
            )).to.be.revertedWithCustomError(expeditions, "InsufficientTotemStage");
        });

        it("Should fail with low happiness", async function () {
            // Modify the train action to reduce happiness
            await game.updateActionConfig(1, { // Train
                cost: ethers.parseUnits("10", 18),
                cooldown: 0,
                maxDaily: 100, // Set high daily limit
                minHappiness: 0, // Set low min happiness
                happinessChange: 10, // Reduce happiness
                experienceGain: 50,
                useTimeWindows: false,
                increasesHappiness: false, // Reduces happiness
                enabled: true
            });

            // Get initial happiness
            const initialAttrs = await nft.attributes(landTeamIds[1]);
            const initialHappiness = Number(initialAttrs.happiness);
            
            // Calculate how many training sessions needed to reduce below threshold
            // Assuming expedition requires 10 happiness minimum
            const targetHappiness = expeditionConfig.happinessCost - 1; // One less than required
            const trainingNeeded = Math.ceil((initialHappiness - targetHappiness) / 10);
            
            // Train enough times to reduce happiness below threshold
            for (let i = 0; i < trainingNeeded; i++) {
                await token.connect(addr1).approve(
                    await game.getAddress(),
                    ethers.parseUnits("10", 18)
                );
                await game.connect(addr1).train(landTeamIds[1]);
            }
            
            // Verify happiness is now below threshold
            const finalAttrs = await nft.attributes(landTeamIds[1]);
            expect(Number(finalAttrs.happiness)).to.be.lessThan(expeditionConfig.happinessCost);
            
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Attempt expedition with unhappy totem
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            )).to.be.revertedWithCustomError(expeditions, "TotemHappinessLow");
        });

        it("Should fail if expedition already in progress", async function () {
            // Start a first expedition
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            await expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            );
            
            // Create another team
            const moreTotems = await prepareTotemTeam(addr1, [2, 8, 5], 2);
            
            // Try to start another expedition 
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [moreTotems[0], moreTotems[1], moreTotems[2]]
            )).to.be.revertedWithCustomError(expeditions, "ActiveExpeditionExists");
        });

        it("Should fail if totem already on expedition", async function () {
            // Start a first expedition
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            await expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            );
            
            // Create another team with one totem already on expedition
            const moreTotems = await prepareTotemTeam(addr1, [2, 8], 2);
            
            // Try to start another expedition using a totem that's already on one
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId2, 
                [moreTotems[0], landTeamIds[0], moreTotems[1]] // landTeamIds[0] is already on expedition
            )).to.be.revertedWithCustomError(expeditions, "TotemsOnExpedition");
        });

        it("Should fail if not token owner", async function () {
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Try to use addr1's totems from addr2's account
            await expect(expeditions.connect(addr2).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            )).to.be.revertedWithCustomError(expeditions, "NotTokenOwner");
        });
        
        it("Should fail with insufficient token approval", async function () {
            // Set insufficient approval
            await token.connect(addr1).approve(
                await game.getAddress(),
                ethers.parseUnits("1", 18) // Too little
            );
            
            // Attempt expedition with insufficient token approval
            await expect(expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            )).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        });
    });

    describe("Completing Expeditions", function () {
        let expeditionId;
        let expeditionId2;
        let landTeamIds;

        beforeEach(async function () {
            expeditionId = ethers.id(expeditionConfig.idString);
            expeditionId2 = ethers.id(expeditionConfig2.idString);
            
            // Prepare land-domain team (Wolf, Bear, Deer - all land domain)
            landTeamIds = await prepareTotemTeam(addr1, [2, 8, 5], 2);
            
            // Approve tokens for expedition cost
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Start expedition
            await expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            );
        });

        it("Should allow claiming rewards after expedition ends", async function () {
            // Fast forward to after expedition end
            await time.increase(expeditionConfig.duration + 60); // Add 60 seconds buffer
            
            // Claim rewards
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId);
            
            // Check expedition completed
            const expeditionState = await expeditions.getUserExpeditions(addr1.address);
            expect(expeditionState.completed[0]).to.be.true;
            
            // Check totems released from expedition
            for (const tokenId of landTeamIds) {
                const [isOnExpedition, _] = await expeditions.isTotemOnExpedition(tokenId);
                expect(isOnExpedition).to.be.false;
            }
            
            // Check no active expeditions
            const activeExpeditions = await expeditions.getUserActiveExpeditions(addr1.address);
            expect(activeExpeditions.ids.length).to.equal(0);
        });

        it("Should award different rewards based on expedition score", async function() {
            // Create a strong team for high score
            const highScoreTeam = await prepareTotemTeam(addr1, [2, 8, 8], 4); // Wolf + 2 Bears (matching domain and affinity)
            
            // Create a weak team for low score
            const lowScoreTeam = await prepareTotemTeam(addr2, [2, 7, 11], 2); // Mixed air team on land expedition
            
            // Set up and start high score expedition
            await token.connect(addr1).approve(
              await game.getAddress(),
              expeditionConfig.totemCost
            );
            await expeditions.connect(addr1).startExpedition(expeditionId2, highScoreTeam);
            
            // Set up and start low score expedition
            if (!(await game.hasSignedUp(addr2.address))) {
              await game.connect(addr2).signup();
            }
            await token.connect(addr2).approve(
              await game.getAddress(),
              expeditionConfig.totemCost
            );
            
            // Configure a new land expedition for low score team
            const newExpId = ethers.id("land_exp_for_air_team");
            await expeditions.configureExpedition(
              "land_exp_for_air_team",
              "Earth Expedition for Air Team",
              Domain.Earth, // Earth domain with air team = low score
              expeditionConfig.duration,
              expeditionConfig.totemCost,
              expeditionConfig.happinessCost,
              expeditionConfig.baseExperience,
              expeditionConfig.affinityWeights,
              expeditionConfig.runeDropChances,
              expeditionConfig.minStage
            );
            
            await expeditions.connect(addr2).startExpedition(newExpId, lowScoreTeam);
            
            // Record initial experience
            const initialHighTeamExp = [];
            const initialLowTeamExp = [];
            
            for (const id of highScoreTeam) {
              const attrs = await nft.attributes(id);
              initialHighTeamExp.push(attrs.experience);
            }
            
            for (const id of lowScoreTeam) {
              const attrs = await nft.attributes(id);
              initialLowTeamExp.push(attrs.experience);
            }
            
            // Fast forward
            await time.increase(expeditionConfig.duration + 60);
            
            // Claim both expeditions
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId2);
            await expeditions.connect(addr2).claimExpeditionRewards(newExpId);
            
            // Check experience gains
            let highTeamGain = 0;
            let lowTeamGain = 0;
            
            for (let i = 0; i < 3; i++) {
              const highTeamAttrs = await nft.attributes(highScoreTeam[i]);
              const lowTeamAttrs = await nft.attributes(lowScoreTeam[i]);
              
              highTeamGain += Number(highTeamAttrs.experience - initialHighTeamExp[i]);
              lowTeamGain += Number(lowTeamAttrs.experience - initialLowTeamExp[i]);
            }
            
            // High score team should get more experience
            expect(highTeamGain).to.be.greaterThan(lowTeamGain);
        });

        it("Should fail claiming before expedition ends", async function () {
            // Try to claim immediately (before expedition duration ends)
            await expect(expeditions.connect(addr1).claimExpeditionRewards(expeditionId))
                .to.be.revertedWithCustomError(expeditions, "ExpeditionNotComplete");
        });

        it("Should fail claiming expedition twice", async function () {
            // Fast forward to after expedition end
            await time.increase(expeditionConfig.duration + 60);
            
            // First claim is successful
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId);
            
            // Second claim should fail
            await expect(expeditions.connect(addr1).claimExpeditionRewards(expeditionId))
                .to.be.revertedWithCustomError(expeditions, "ExpeditionAlreadyClaimed");
        });

        it("Should fail claiming non-existent expedition", async function () {
            await time.increase(expeditionConfig.duration + 60);
            
            // Try to claim with invalid ID
            const invalidId = ethers.id("non_existent_expedition");
            await expect(expeditions.connect(addr1).claimExpeditionRewards(invalidId))
                .to.be.revertedWithCustomError(expeditions, "ExpeditionNotFound");
        });
    });

    describe("Expedition Results", function () {
        let expeditionId;
        let landTeamIds;

        beforeEach(async function () {
            expeditionId = ethers.id(expeditionConfig.idString);
            
            // Prepare land-domain team with matching affinities for good score
            // Wolf (strength), Bear (strength), Deer (agility)
            landTeamIds = await prepareTotemTeam(addr1, [2, 8, 5], 2);
            
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            await expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            );
        });

        it("Should process expedition score and rewards correctly", async function () {
            // Get initial experience values
            const initialExperienceValues = [];
            for (const tokenId of landTeamIds) {
                const attrs = await nft.attributes(tokenId);
                initialExperienceValues.push(attrs.experience);
            }
            
            // Fast forward to after expedition end
            await time.increase(expeditionConfig.duration + 60);
            
            // Claim rewards
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId);
            
            // Check experience increased
            for (let i = 0; i < landTeamIds.length; i++) {
                const attrs = await nft.attributes(landTeamIds[i]);
                expect(attrs.experience).to.be.gt(initialExperienceValues[i]);
            }
        });

        it("Should award variable rewards based on team composition", async function () {
            // Fast forward to after expedition end
            await time.increase(expeditionConfig.duration + 60);
            
            // Claim rewards for first expedition
            await expeditions.connect(addr1).claimExpeditionRewards(expeditionId);
            
            // Configure a water expedition for testing
            await expeditions.configureExpedition(
                "water_expedition",  // New ID
                "Water Expedition", 
                Domain.Water,
                expeditionConfig.duration,
                expeditionConfig.totemCost,
                expeditionConfig.happinessCost,
                expeditionConfig.baseExperience,
                expeditionConfig.affinityWeights,
                expeditionConfig.runeDropChances,
                expeditionConfig.minStage
            );
            
            const waterExpeditionId = ethers.id("water_expedition");
            
            // Create a water domain team
            const waterTeamIds = await prepareTotemTeam(addr2, [0, 1, 4], 2); // Goose, Otter, Beaver
            
            // Set up addr2
            if (!(await game.hasSignedUp(addr2.address))) {
                await game.connect(addr2).signup();
            }
            await token.connect(addr2).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            // Start the water expedition
            await expeditions.connect(addr2).startExpedition(
                waterExpeditionId, 
                [waterTeamIds[0], waterTeamIds[1], waterTeamIds[2]]
            );
            
            // Fast forward to after expedition end
            await time.increase(expeditionConfig.duration + 60);
            
            // Claim rewards
            await expeditions.connect(addr2).claimExpeditionRewards(waterExpeditionId);
            
            // Both expeditions completed successfully
            const addr1Expeditions = await expeditions.getUserExpeditions(addr1.address);
            const addr2Expeditions = await expeditions.getUserExpeditions(addr2.address);
            
            expect(addr1Expeditions.completed[0]).to.be.true;
            expect(addr2Expeditions.completed[0]).to.be.true;
        });
    });

    describe("Expedition Query Functions", function () {
        let expeditionId;
        let expeditionId2;
        let landTeamIds;

        beforeEach(async function () {
            expeditionId = ethers.id(expeditionConfig.idString);
            expeditionId2 = ethers.id(expeditionConfig2.idString);
            
            // Prepare land-domain team
            landTeamIds = await prepareTotemTeam(addr1, [2, 8, 5], 2);
            
            await token.connect(addr1).approve(
                await game.getAddress(),
                expeditionConfig.totemCost
            );
            
            await expeditions.connect(addr1).startExpedition(
                expeditionId, 
                [landTeamIds[0], landTeamIds[1], landTeamIds[2]]
            );
        });

        it("Should return all expedition IDs", async function () {
            const ids = await expeditions.getExpeditions();
            expect(ids.length).to.equal(2);
            expect(ids[0]).to.equal(expeditionId);
            expect(ids[1]).to.equal(expeditionId2);
        });

        it("Should return user expeditions", async function () {
            const userExpeditions = await expeditions.getUserExpeditions(addr1.address);
            
            expect(userExpeditions.ids.length).to.equal(1);
            expect(userExpeditions.ids[0]).to.equal(expeditionId);
            expect(userExpeditions.completed[0]).to.be.false;
            
            // Check totem IDs match
            expect(userExpeditions.totemIds[0][0]).to.equal(landTeamIds[0]);
            expect(userExpeditions.totemIds[0][1]).to.equal(landTeamIds[1]);
            expect(userExpeditions.totemIds[0][2]).to.equal(landTeamIds[2]);
        });
    });
});