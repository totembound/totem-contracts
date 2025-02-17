const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemNFT", function () {
    let TotemNFT, MockRandomOracle;
    let nft, randomOracle;
    let owner, addr1, addr2;
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy mock random oracle
        MockRandomOracle = await ethers.getContractFactory("MockRandomOracle");
        randomOracle = await MockRandomOracle.deploy();

        // Deploy mock achievements
        const MockAchievements = await ethers.getContractFactory("MockAchievements");
        achievements = await MockAchievements.deploy();

        // Deploy proxy admin
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // Deploy TotemNFT
        TotemNFT = await ethers.getContractFactory("TotemNFT");
        const nftImplementation = await TotemNFT.deploy();
        const initNFTData = TotemNFT.interface.encodeFunctionData("initialize");

        // Deploy proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        const nftProxy = await TotemProxy.deploy(
            await nftImplementation.getAddress(),
            await proxyAdmin.getAddress(),
            initNFTData
        );

         // Get NFT interface at proxy address
         nft = await ethers.getContractAt("TotemNFT", await nftProxy.getAddress());

        // Set random oracle
        await nft.setRandomOracle(await randomOracle.getAddress());

        // Set achievements contract
        await nft.setAchievements(await achievements.getAddress());

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

        // Configure thresholds
        await nft.setPrestigeXpThreshold(7500);      // Base prestige threshold
        await nft.setPrestigeXpThresholdLevels(2500); // XP per prestige level

        nft.on("DebugEvolution", (tokenId, stage, exp, requiredExp, message) => {
            console.log(`Debug: ${message} - Token ${tokenId} at Stage ${stage} with EXP ${exp}/${requiredExp}`);
        });

    });

    describe("Initialization", function () {
        it("Should initialize with correct name and symbol", async function () {
            expect(await nft.name()).to.equal("Totem");
            expect(await nft.symbol()).to.equal("TOTEM");
        });

        it("Should initialize valid colors for each rarity", async function () {
            // Test a few sample color validations
            expect(await nft.validColorForRarity(0, 0)).to.be.true;  // Common, Brown
            expect(await nft.validColorForRarity(1, 5)).to.be.true;  // Uncommon, Copper
            expect(await nft.validColorForRarity(2, 8)).to.be.true;  // Rare, Golden
            expect(await nft.validColorForRarity(3, 12)).to.be.true; // Epic, EmeraldGreen
            expect(await nft.validColorForRarity(4, 15)).to.be.true; // Legendary, RadiantGold
        });
    });

    describe("Minting", function () {
        it("Should mint a new token with correct attributes", async function () {
            await nft.mint(addr1.address, 0); // Mint Goose
            const tokenId = 1;
            
            const attrs = await nft.attributes(tokenId);
            expect(attrs.species).to.equal(0); // Goose
            expect(attrs.happiness).to.equal(50);
            expect(attrs.experience).to.equal(0);
            expect(attrs.stage).to.equal(0);
            expect(attrs.isStaked).to.be.false;
        });

        it("Should fail minting with invalid species", async function () {
            await expect(nft.mint(addr1.address, 12)) // Species.None
                .to.be.revertedWithCustomError(nft, "InvalidSpecies");
        });

        it("Should use randomness for rarity and color", async function () {
            await nft.mint(addr1.address, 0);
            const tokenId = 1;
            const attrs = await nft.attributes(tokenId);
            
            // Verify rarity and color are set
            expect(attrs.rarity).to.be.lte(4); // Valid rarity (0-4)
            expect(attrs.color).to.be.lte(18);  // Valid color (0-18)
            expect(await nft.validColorForRarity(attrs.rarity, attrs.color)).to.be.true;
        });

        it("Should only allow owner to mint", async function () {
            await expect(nft.connect(addr1).mint(addr2.address, 0))
                .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
        });
    });

    describe("Evolution", function () {
        let tokenId, tokenAttrs;
    
        beforeEach(async function () {
            // Mint the token
            await nft.mint(addr1.address, 0);
            tokenId = 1;
            
            // Get the assigned attributes from random oracle
            tokenAttrs = await nft.attributes(tokenId);
            
            // CRITICAL: Set metadata URIs for ALL stages before testing
            for (let stage = 0; stage <= 4; stage++) {
                await nft.setMetadataURI(
                    tokenAttrs.species,
                    tokenAttrs.color,
                    stage,
                    `ipfs://test-hash-stage-${stage}`
                );
            }
        });

        it("Should evolve when experience requirement met", async function () {
            // Update experience to meet first threshold (500)
            await nft.updateAttributes(tokenId, 0, true, 500);
            
            await nft.connect(addr1).evolve(tokenId);
            const attrs = await nft.attributes(tokenId);
            expect(attrs.stage).to.equal(1);
        });

        it("Should fail evolution with insufficient experience", async function () {
            // Explicitly check initial experience and first stage threshold
            const initialAttrs = await nft.attributes(tokenId);
            const firstStageThreshold = await nft.stageThresholds(0);

            // Ensure the initial experience is less than the first stage threshold
            expect(initialAttrs.experience).to.be.lt(firstStageThreshold);

            // Now attempt to evolve
            await expect(nft.connect(addr1).evolve(tokenId))
                .to.be.revertedWithCustomError(nft, "InsufficientExperience");
        });

        it("Should fail evolution at max stage", async function () {
            // Fast track to max stage
            await nft.updateAttributes(tokenId, 0, true, 7500);
            
            // Evolve through all stages
            for(let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }
            
            // Try to evolve past max stage
            await expect(nft.connect(addr1).evolve(tokenId))
                .to.be.revertedWithCustomError(nft, "MaxStageReached");
        });
    
        it("Should emit TotemEvolved event", async function () {
            await nft.updateAttributes(tokenId, 0, true, 500);
            
            await expect(nft.connect(addr1).evolve(tokenId))
                .to.emit(nft, "TotemEvolved")
                .withArgs(tokenId, 1, tokenAttrs.species, tokenAttrs.rarity);
        });
    });

    describe("Prestige System", function () {
        let tokenId;
    
        beforeEach(async function () {
            // Mint token and set up metadata URIs
            await nft.mint(addr1.address, 0);
            tokenId = 1;
            
            // Set metadata URIs for all stages
            const attrs = await nft.attributes(tokenId);
            for (let stage = 0; stage <= 4; stage++) {
                await nft.setMetadataURI(
                    attrs.species,
                    attrs.color,
                    stage,
                    `ipfs://test-hash-stage-${stage}`
                );
            }
        });
    
        it("Should not have prestige before reaching elder stage", async function () {
            await nft.updateAttributes(tokenId, 0, true, 7000); // High XP but not elder
            
            const [prestigeLevel, nextThreshold] = await nft.getPrestigeInfo(tokenId);
            expect(prestigeLevel).to.equal(0);
            expect(nextThreshold).to.equal(0);
        });
    
        it("Should calculate prestige level correctly at elder stage", async function () {
            // Evolve to elder (stage 4)
            await nft.updateAttributes(tokenId, 0, true, 7500);
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }
    
            // Add more XP for first prestige level (need full 2500)
            await nft.updateAttributes(tokenId, 0, true, 2500);
            
            let [prestigeLevel, nextThreshold] = await nft.getPrestigeInfo(tokenId);
            expect(prestigeLevel).to.equal(1);
            expect(nextThreshold).to.equal(12500); // 7500 + (1+1)*2500
    
            // Add more XP for next prestige level
            await nft.updateAttributes(tokenId, 0, true, 2500);
            
            [prestigeLevel, nextThreshold] = await nft.getPrestigeInfo(tokenId);
            expect(prestigeLevel).to.equal(2);
            expect(nextThreshold).to.equal(15000); // 7500 + (2+1)*2500
        });
    
        it("Should emit PrestigeLevelReached event", async function () {
            // Evolve to elder (stage 4)
            await nft.updateAttributes(tokenId, 0, true, 7500);
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }

            // Now add enough XP to trigger first prestige level
            // Expect the event to be emitted
            await expect(nft.updateAttributes(tokenId, 0, true, 2500))
                .to.emit(nft, "PrestigeLevelReached")
                .withArgs(tokenId, 1);
        });
    
        it("Should track multiple prestige levels correctly", async function () {
            // Evolve to elder
            await nft.updateAttributes(tokenId, 0, true, 7500);
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }
    
            // Test multiple prestige levels
            const testLevels = [
                { xpGain: 2500, expectedLevel: 1, expectedNext: 12500 },
                { xpGain: 2500, expectedLevel: 2, expectedNext: 15000 },
                { xpGain: 2500, expectedLevel: 3, expectedNext: 17500 },
                { xpGain: 2500, expectedLevel: 4, expectedNext: 20000 }
            ];
    
            for (const test of testLevels) {
                await nft.updateAttributes(tokenId, 0, true, test.xpGain);
                const [level, next] = await nft.getPrestigeInfo(tokenId);
                expect(level).to.equal(test.expectedLevel);
                expect(next).to.equal(test.expectedNext);
            }
        });
    
        it("Should maintain happiness independent of prestige", async function () {
            // Evolve to elder 
            await nft.updateAttributes(tokenId, 0, true, 7500);
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }

            // Add enough XP to trigger first prestige level
            await nft.updateAttributes(tokenId, 0, true, 2500);

            // Manipulate happiness
            await nft.updateAttributes(tokenId, 20, false, 0); // Decrease happiness
            const attrs = await nft.attributes(tokenId);
            
            // Check prestige level and happiness separately
            const [prestigeLevel, _] = await nft.getPrestigeInfo(tokenId);
            expect(prestigeLevel).to.equal(1); // Has first prestige
            expect(attrs.happiness).to.equal(30); // 50 - 20
        });
    
        it("Should handle partial progress towards next prestige level", async function () {
            // Evolve to elder
            await nft.updateAttributes(tokenId, 0, true, 7500);
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }
    
            // Add partial XP towards first prestige
            await nft.updateAttributes(tokenId, 0, true, 1000);
            
            const [level, next] = await nft.getPrestigeInfo(tokenId);
            expect(level).to.equal(0);  // Not yet reached first prestige
            expect(next).to.equal(10000); // Base + 1*level_threshold
            
            // Verify attributes directly
            const attrs = await nft.attributes(tokenId);
            expect(attrs.experience).to.equal(8500); // 7500 + 1000
            expect(attrs.prestigeLevel).to.equal(0);
        });
    
        it("Should work with achievement system", async function () {
            // First reach elder with base XP
            await nft.updateAttributes(tokenId, 0, true, 7500);
            
            // Need to evolve through all stages first
            for (let i = 0; i < 4; i++) {
                await nft.connect(addr1).evolve(tokenId);
            }
    
            // Then gain enough XP for first prestige level
            await nft.updateAttributes(tokenId, 0, true, 2500);
    
            // Verify achievement was triggered
            expect(await achievements.wasProgressUpdated(
                ethers.id("prestige_progression"),
                addr1.address
            )).to.be.true;
        });
    });

    describe("Metadata Management", function () {
        it("Should set and retrieve metadata URI", async function () {
            const species = 0;
            const color = 0;
            const stage = 0;
            const hash = "QmTest123";
            
            await nft.setMetadataURI(species, color, stage, hash);
            
            const uri = await nft.getMetadataURI(species, color, stage);
            expect(uri).to.equal(`ipfs://${hash}`);
        });

        it("Should batch set metadata URIs", async function () {
            const species = [0, 1];
            const colors = [0, 1];
            const stages = [0, 0];
            const hashes = ["hash1", "hash2"];
            
            await nft.batchSetMetadataURIs(species, colors, stages, hashes);
            
            expect(await nft.getMetadataURI(0, 0, 0)).to.equal("ipfs://hash1");
            expect(await nft.getMetadataURI(1, 1, 0)).to.equal("ipfs://hash2");
        });

        it("Should fail setting metadata with invalid parameters", async function () {
            await expect(nft.setMetadataURI(0, 16, 0, "hash")) // Invalid color
                .to.be.revertedWithCustomError(nft, "InvalidColor");
                
            await expect(nft.setMetadataURI(0, 0, 5, "hash")) // Invalid stage
                .to.be.revertedWithCustomError(nft, "InvalidStage");
        });
    });

    describe("Display Name", function () {
        beforeEach(async function () {
            await nft.mint(addr1.address, 0);
        });

        it("Should set display name by owner", async function () {
            await nft.connect(addr1).setDisplayName(1, "MyTotem");
            const attrs = await nft.attributes(1);
            expect(attrs.displayName).to.equal("MyTotem");
        });

        it("Should fail setting invalid display names", async function () {
            // Too long (>32 chars)
            const longName = "ThisNameIsMuchTooLongToBeValidForATotem";
            await expect(nft.connect(addr1).setDisplayName(1, longName))
                .to.be.revertedWithCustomError(nft, "InvalidNameFormat");

            // Empty name
            await expect(nft.connect(addr1).setDisplayName(1, ""))
                .to.be.revertedWithCustomError(nft, "InvalidNameFormat");
        });
    });

    describe("Token Queries", function () {
        beforeEach(async function () {
            // Mint multiple tokens
            await nft.mint(addr1.address, 0);
            await nft.mint(addr1.address, 1);
            await nft.mint(addr2.address, 2);
        });

        it("Should return correct tokens of owner", async function () {
            const addr1Tokens = await nft.tokensOfOwner(addr1.address);
            expect(addr1Tokens.length).to.equal(2);
            expect(addr1Tokens[0]).to.equal(1);
            expect(addr1Tokens[1]).to.equal(2);

            const addr2Tokens = await nft.tokensOfOwner(addr2.address);
            expect(addr2Tokens.length).to.equal(1);
            expect(addr2Tokens[0]).to.equal(3);
        });
    });

    describe("Attribute Updates", function () {
        beforeEach(async function () {
            await nft.mint(addr1.address, 0);
        });

        it("Should update happiness correctly", async function () {
            // Test increase
            await nft.updateAttributes(1, 20, true, 0);
            let attrs = await nft.attributes(1);
            expect(attrs.happiness).to.equal(70);

            // Test decrease
            await nft.updateAttributes(1, 30, false, 0);
            attrs = await nft.attributes(1);
            expect(attrs.happiness).to.equal(40);
        });

        it("Should update experience correctly", async function () {
            await nft.updateAttributes(1, 0, true, 100);
            const attrs = await nft.attributes(1);
            expect(attrs.experience).to.equal(100);
        });
    });
});
