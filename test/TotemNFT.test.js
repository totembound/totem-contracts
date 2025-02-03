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

        await nft.setValidColorsForRarities(
            [0, 0, 0, 0, 0,  // Common
             1, 1, 1, 1, 1,  // Uncommon
             2, 2, 2, 2,     // Rare
             3, 3, 3,        // Epic
             4, 4],          // Legendary
        
            [0, 1, 2, 3, 4,  // Common -> Brown, Gray, White, Tawny, Speckled
             5, 6, 7, 8, 9,  // Uncommon -> Russet, Slate, Copper, Cream, Dappled
             10, 11, 12, 13, // Rare -> Golden, DarkPurple, LightBlue, Charcoal
             14, 15, 16,     // Epic -> EmeraldGreen, CrimsonRed, DeepSapphire
             17, 18]         // Legendary -> RadiantGold, EtherealSilver
        );
    });

    describe("Initialization", function () {
        it("Should initialize with correct name and symbol", async function () {
            expect(await nft.name()).to.equal("Totem");
            expect(await nft.symbol()).to.equal("TOTEM");
        });

        it("Should initialize valid colors for each rarity", async function () {
            // Test a few sample color validations
            expect(await nft.validColorForRarity(0, 0)).to.be.true;  // Common, Brown
            expect(await nft.validColorForRarity(1, 5)).to.be.true;  // Uncommon, Russet
            expect(await nft.validColorForRarity(2, 10)).to.be.true; // Rare, Golden
            expect(await nft.validColorForRarity(3, 14)).to.be.true; // Epic, EmeraldGreen
            expect(await nft.validColorForRarity(4, 17)).to.be.true; // Legendary, RadiantGold
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
            
            // Set metadata URIs for all potential evolution stages for this token
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

            console.log('Initial Experience:', initialAttrs.experience.toString());
            console.log('First Stage Threshold:', firstStageThreshold.toString());

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
            await expect(nft.setMetadataURI(0, 19, 0, "hash")) // Invalid color
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
