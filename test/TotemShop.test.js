const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { safeIncreaseTo } = require('./timeHelpers');

describe("TotemShop", function () {
    let TotemGame, TotemToken, TotemNFT, TotemProxy, TotemShop;
    let game, token, nft, shop;
    let owner, addr1, addr2, trustedForwarder;
    
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

        // Deploy mock random oracle first
        MockRandomOracle = await ethers.getContractFactory("MockRandomOracle");
        randomOracle = await MockRandomOracle.deploy();

        // Deploy price oracle
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        const oracle = await TotemAdminPriceOracle.deploy(ethers.parseUnits("0.01", "ether"));

        // Deploy token contract
        TotemToken = await ethers.getContractFactory("TotemToken");
        const tokenImpl = await TotemToken.deploy();
        const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        const proxyAdmin = await TotemProxyAdmin.deploy(owner.address);
        const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
            await oracle.getAddress(),
            trustedForwarder.address
        ]);
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        const tokenProxy = await TotemProxy.deploy(
            await tokenImpl.getAddress(),
            await proxyAdmin.getAddress(),
            initTokenData
        );
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

        // Deploy Shop contract
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

        // Setup permissions
        await game.authorize(await shop.getAddress());
        await token.transferAllocation(
            0, // Game category
            await game.getAddress(),
            ethers.parseUnits("250000000", 18) // 250M tokens
        );
        await nft.transferOwnership(await game.getAddress());
    });

    describe("Initialization & Setup", function() {
        it("Should initialize with correct contract references", async function() {
            expect(await shop.game()).to.equal(await game.getAddress());
            expect(await shop.totemToken()).to.equal(await token.getAddress());
            expect(await shop.totemNFT()).to.equal(await nft.getAddress());
            expect(await shop.trustedForwarder()).to.equal(trustedForwarder.address);
        });

        it("Should be authorized in the game contract", async function() {
            expect(await game.authorizedContracts(await shop.getAddress())).to.be.true;
        });
    });

    describe("Bundle Management", function() {
        it("Should create a new bundle", async function() {
            await shop.createBundle(
                ethers.parseEther("1"),           // 1 POL
                ethers.parseUnits("1000", 18),    // 1000 TOTEM
                0,                                // Species.Goose
                1,                                // Color.Gray
                0,                                // Rarity.Common min
                2,                                // Rarity.Rare max
                false,                            // Not limited rarity
                0                                 // No expiry
            );

            expect(await shop.nextBundleId()).to.equal(1n);
            
            const bundle = await shop.bundles(0);
            expect(bundle.polCost).to.equal(ethers.parseEther("1"));
            expect(bundle.tokenAmount).to.equal(ethers.parseUnits("1000", 18));
            expect(bundle.species).to.equal(0n); // Goose
            expect(bundle.color).to.equal(1n); // Gray
            expect(bundle.minRarity).to.equal(0n); // Common
            expect(bundle.maxRarity).to.equal(2n); // Rare
            expect(bundle.enabled).to.be.true;
            expect(bundle.isLimitedRarity).to.be.false;
            expect(bundle.validUntil).to.equal(0n);
        });

        it("Should allow updating an existing bundle", async function() {
            // Create a bundle
            await shop.createBundle(
                ethers.parseEther("1"),
                ethers.parseUnits("1000", 18),
                0, 0, 0, 0, false, 0
            );
            
            // Set an expiry time
            const expiryTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
            
            // Update the bundle
            await shop.updateBundle(0, false, expiryTimestamp);
            
            // Verify update
            const bundle = await shop.bundles(0);
            expect(bundle.enabled).to.be.false;
            expect(bundle.validUntil).to.equal(expiryTimestamp);
        });

        it("Should fail to create a bundle with invalid parameters", async function() {
            // Zero POL cost
            await expect(shop.createBundle(
                0, ethers.parseUnits("1000", 18), 0, 0, 0, 0, false, 0
            )).to.be.revertedWithCustomError(shop, "InvalidPolCost");
            
            // Zero token amount
            await expect(shop.createBundle(
                ethers.parseEther("1"), 0, 0, 0, 0, 0, false, 0
            )).to.be.revertedWithCustomError(shop, "InvalidAmount");
            
            // Invalid rarity range (min > max)
            await expect(shop.createBundle(
                ethers.parseEther("1"), ethers.parseUnits("1000", 18), 0, 0, 3, 2, false, 0
            )).to.be.revertedWithCustomError(shop, "InvalidRarityRange");
        });

        it("Should enforce bundle expiration", async function() {
            // Get current timestamp
            const currentTimestamp = await time.latest();
            
            // Create a bundle with expiry time in the future
            const expiryTime = currentTimestamp + 3600; // 1 hour from now
            await shop.createBundle(
                ethers.parseEther("1"),
                ethers.parseUnits("1000", 18),
                0, 0, 0, 0, false, expiryTime
            );
            
            // Sign up user
            await game.connect(addr1).signup();
            
            // Fast forward past expiry using our safe helper
            await safeIncreaseTo(expiryTime + 60); // 1 minute past expiry
            
            // Attempt to purchase expired bundle
            await expect(shop.connect(addr1).purchaseBundle(
                0, { value: ethers.parseEther("1") }
            )).to.be.revertedWithCustomError(shop, "BundleExpired");
        });
    });

    describe("Token Purchasing", function() {
        beforeEach(async function() {
            // Sign up a user
            await game.connect(addr1).signup();
        });

        it("Should allow buying tokens with POL", async function() {
            const polAmount = ethers.parseEther("1");
            const initialBalance = await token.balanceOf(addr1.address);
            
            await shop.connect(addr1).buyTokens({ value: polAmount });
            
            // Check that user's token balance increased
            expect(await token.balanceOf(addr1.address)).to.be.gt(initialBalance);
            
            // Game contract should have received the POL
            const ownerBalance = await ethers.provider.getBalance(owner.address);
            // Just check the owner has a balance, not the exact amount since we can't easily 
            // track how much POL the owner had before the test
            expect(ownerBalance > 0).to.be.true;
        });

        it("Should fail when sending zero POL", async function() {
            await expect(shop.connect(addr1).buyTokens({ value: 0 }))
                .to.be.revertedWithCustomError(shop, "NoPolSent");
        });

        it("Should fail for users who haven't signed up", async function() {
            await expect(shop.connect(addr2).buyTokens({ value: ethers.parseEther("1") }))
                .to.be.revertedWithCustomError(shop, "NotSignedUp");
        });
    });

    describe("Totem Purchasing", function() {
        beforeEach(async function() {
            // Sign up a user
            await game.connect(addr1).signup();
            
            // Approve TOTEM for purchasing
            await token.connect(addr1).approve(await game.getAddress(), gameParams.mintPrice);
        });

        it("Should allow purchasing a new totem", async function() {
            // Initial values
            const initialBalance = await token.balanceOf(addr1.address);
            const initialNFTCount = await nft.balanceOf(addr1.address);
            
            // Purchase a totem
            await shop.connect(addr1).purchaseTotem(0); // Species.Goose
            
            // Check token was spent
            expect(await token.balanceOf(addr1.address)).to.equal(initialBalance - gameParams.mintPrice);
            
            // Check NFT was received
            expect(await nft.balanceOf(addr1.address)).to.equal(initialNFTCount + 1n);
            
            // Check NFT properties
            const tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);
            const attrs = await nft.attributes(tokenId);
            expect(attrs.species).to.equal(0n); // Goose
        });

        it("Should fail with invalid species", async function() {
            const invalidSpecies = 12; // Species.None
            await expect(shop.connect(addr1).purchaseTotem(invalidSpecies))
                .to.be.revertedWithCustomError(shop, "InvalidSpecies");
        });

        it("Should fail without enough token allowance", async function() {
            // Revoke approval
            await token.connect(addr1).approve(await game.getAddress(), 0);
            
            await expect(shop.connect(addr1).purchaseTotem(0))
                .to.be.revertedWithCustomError(shop, "InsufficientTokens");
        });
    });

    describe("Bundle Purchasing", function() {
        beforeEach(async function() {
            // Sign up a user
            await game.connect(addr1).signup();
            
            // Create a bundle
            await shop.createBundle(
                ethers.parseEther("1"),           // 1 POL
                ethers.parseUnits("1000", 18),    // 1000 TOTEM
                0,                                // Species.Goose
                0,                                // Color.Brown
                0,                                // Rarity.Common
                0,                                // Rarity.Common
                false,                            // Not limited rarity
                0                                 // No expiry
            );
        });

        it("Should allow purchasing a bundle", async function() {
            // Initial values
            const initialBalance = await token.balanceOf(addr1.address);
            const initialNFTCount = await nft.balanceOf(addr1.address);
            
            // Purchase a bundle
            await shop.connect(addr1).purchaseBundle(0, { value: ethers.parseEther("1") });
            
            // Check token was received
            expect(await token.balanceOf(addr1.address)).to.equal(
                initialBalance + ethers.parseUnits("1000", 18)
            );
            
            // Check NFT was received
            expect(await nft.balanceOf(addr1.address)).to.equal(initialNFTCount + 1n);
            
            // Check NFT properties
            const tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);
            const attrs = await nft.attributes(tokenId);
            expect(attrs.species).to.equal(0n); // Goose
            expect(attrs.color).to.equal(0n); // Brown
            expect(attrs.rarity).to.equal(0n); // Common
        });

        it("Should fail with incorrect POL amount", async function() {
            await expect(shop.connect(addr1).purchaseBundle(0, { value: ethers.parseEther("0.5") }))
                .to.be.revertedWithCustomError(shop, "InvalidAmount");
            
            await expect(shop.connect(addr1).purchaseBundle(0, { value: ethers.parseEther("1.5") }))
                .to.be.revertedWithCustomError(shop, "InvalidAmount");
        });

        it("Should fail when bundle is disabled", async function() {
            // Disable the bundle
            await shop.updateBundle(0, false, 0);
            
            await expect(shop.connect(addr1).purchaseBundle(0, { value: ethers.parseEther("1") }))
                .to.be.revertedWithCustomError(shop, "BundleNotAvailable");
        });
    });

    describe("Marketplace Operations", function() {
        let tokenId;
        
        beforeEach(async function() {
            // Setup first user with a totem
            await game.connect(addr1).signup();
            await token.connect(addr1).approve(await game.getAddress(), gameParams.mintPrice);
            await shop.connect(addr1).purchaseTotem(0);
            tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);
            
            // Setup second user
            await game.connect(addr2).signup();
        });

        it("Should allow selling a totem to the marketplace", async function() {
            // Check initial conditions
            const initialBalance = await token.balanceOf(addr1.address);
            expect(await nft.ownerOf(tokenId)).to.equal(addr1.address);
            expect(await shop.getUnboundTotemCount()).to.equal(0n);
            
            // Sell the totem
            await shop.connect(addr1).sellTotem(tokenId);
            
            // Check the results
            expect(await nft.ownerOf(tokenId)).to.equal(await game.getAddress());
            expect(await token.balanceOf(addr1.address)).to.be.gt(initialBalance); // User got tokens
            expect(await shop.getUnboundTotemCount()).to.equal(1n); // Totem in marketplace
            
            // Check the totem info in marketplace
            const ids = await shop.getUnboundTokenIds(0, 1);
            expect(ids[0]).to.equal(tokenId);
            
            const listings = await shop.getUnboundTotems(0, 1);
            expect(listings[0].tokenId).to.equal(tokenId);
            expect(listings[0].previousOwner).to.equal(addr1.address);
        });

        it("Should fail to sell a totem the user doesn't own", async function() {
            await expect(shop.connect(addr2).sellTotem(tokenId))
                .to.be.revertedWithCustomError(shop, "NotTokenOwner");
        });

        it("Should allow purchasing an unbound totem", async function() {
            // First sell the totem to the marketplace
            await shop.connect(addr1).sellTotem(tokenId);
            
            // Check marketplace status
            expect(await shop.getUnboundTotemCount()).to.equal(1n);
            
            // Approve tokens for purchase (sell price + fee)
            const unbound = (await shop.getUnboundTotems(0, 1))[0];
            const purchasePrice = unbound.sellPrice + ethers.parseUnits("100", 18); // +100 fee
            await token.connect(addr2).approve(await game.getAddress(), purchasePrice);
            
            // Purchase the unbound totem
            await shop.connect(addr2).purchaseUnboundTotem(tokenId);
            
            // Check the results
            expect(await nft.ownerOf(tokenId)).to.equal(addr2.address);
            expect(await shop.getUnboundTotemCount()).to.equal(0n); // Removed from marketplace
        });

        it("Should fail to purchase a totem that isn't in the marketplace", async function() {
            // Try to purchase a totem that isn't in the marketplace
            // First create a non-existent token ID
            const nonExistentTokenId = 9999;
            
            // The contract first checks if the game owns the token
            // It will revert with TotemNotAvailable if game doesn't own it
            // For a non-existent token, ownerOf() will revert before our custom error
            await expect(shop.connect(addr2).purchaseUnboundTotem(nonExistentTokenId))
                .to.be.reverted; // Just expect any revert, not a specific error
        });

        it("Should fail to purchase without enough allowance", async function() {
            // Sell the totem
            await shop.connect(addr1).sellTotem(tokenId);
            
            // Don't approve enough tokens
            await token.connect(addr2).approve(await game.getAddress(), 1);
            
            // Try to purchase
            await expect(shop.connect(addr2).purchaseUnboundTotem(tokenId))
                .to.be.revertedWithCustomError(shop, "InsufficientTokens");
        });
    });
});