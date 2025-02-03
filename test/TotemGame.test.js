const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { safeIncreaseTo } = require('./timeHelpers');

describe("TotemGame", function () {
    let TotemGame, TotemToken, TotemNFT, TotemProxy, TotemProxyAdmin;
    let game, token, nft, proxy, proxyAdmin;
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

        // Deploy TotemNFT
        TotemNFT = await ethers.getContractFactory("TotemNFT");
        const nftImplementation = await TotemNFT.deploy();;
        const initNFTData = TotemNFT.interface.encodeFunctionData("initialize");
        const nftProxy = await TotemProxy.deploy(
            await nftImplementation.getAddress(),
            await proxyAdmin.getAddress(),
            initNFTData
        );

         // Get NFT interface at proxy address
         nft = await ethers.getContractAt("TotemNFT", await nftProxy.getAddress());

        // Set up random oracle for NFT
        await nft.setRandomOracle(await randomOracle.getAddress());

        // Deploy Game Implementation and Proxy
        TotemGame = await ethers.getContractFactory("TotemGame");
        const gameImpl = await TotemGame.deploy();

        // Initialize proxy with implementation
        const initData = TotemGame.interface.encodeFunctionData("initialize", [
            await token.getAddress(),
            await nft.getAddress(),
            trustedForwarder.address,
            gameParams,
            timeWindows
        ]);

        // Deploy and initialize proxy
        proxy = await TotemProxy.deploy(
            await gameImpl.getAddress(),
            owner.address,
            initData
        );

        // Get game contract interface at proxy address
        game = await ethers.getContractAt("TotemGame", await proxy.getAddress());

        // Transfer token allocation to game contract
        await token.transferAllocation(
            0, // Game category
            await game.getAddress(),
            ethers.parseUnits("250000000", 18) // 250M tokens
        );

        // Transfer NFT ownership to game contract
        await nft.transferOwnership(await game.getAddress());
    });

    describe("Initialization", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await game.totemToken()).to.equal(await token.getAddress());
            expect(await game.totemNFT()).to.equal(await nft.getAddress());
            expect(await game.trustedForwarder()).to.equal(trustedForwarder.address);

            const params = await game.gameParams();
            expect(params.signupReward).to.equal(gameParams.signupReward);
            expect(params.mintPrice).to.equal(gameParams.mintPrice);
        });

        it("Should have correct time windows set", async function () {
            const windows = await game.timeWindows();
            expect(windows.window1Start).to.equal(timeWindows.window1Start);
            expect(windows.window2Start).to.equal(timeWindows.window2Start);
            expect(windows.window3Start).to.equal(timeWindows.window3Start);
        });

        it("Should have default action configurations", async function () {
            const feedConfig = await game.actionConfigs(0); // Feed
            const trainConfig = await game.actionConfigs(1); // Train
            const treatConfig = await game.actionConfigs(2); // Treat

            // Verify Feed configuration
            expect(feedConfig.cost).to.equal(ethers.parseUnits("10", 18));
            expect(feedConfig.maxDaily).to.equal(3n);
            expect(feedConfig.useTimeWindows).to.be.true;

            // Verify Train configuration
            expect(trainConfig.cost).to.equal(ethers.parseUnits("20", 18));
            expect(trainConfig.minHappiness).to.equal(20n);
            expect(trainConfig.experienceGain).to.equal(50n);

            // Verify Treat configuration
            expect(treatConfig.cost).to.equal(ethers.parseUnits("20", 18));
            expect(treatConfig.cooldown).to.equal(14400n);
            expect(treatConfig.maxDaily).to.equal(2n);
        });
    });

    describe("User Signup", function () {
        it("Should allow new user to sign up", async function () {
            await game.connect(addr1).signup();
            expect(await game.hasSignedUp(addr1.address)).to.be.true;
            expect(await token.balanceOf(addr1.address)).to.equal(gameParams.signupReward);
        });

        it("Should prevent double signup", async function () {
            await game.connect(addr1).signup();
            await expect(game.connect(addr1).signup())
                .to.be.revertedWithCustomError(game, "AlreadySignedUp");
        });
    });

    describe("Token Purchase", function () {
        beforeEach(async function () {
            await game.connect(addr1).signup();
        });

        it("Should allow buying tokens with POL", async function () {
            const polAmount = ethers.parseEther("1");
            const initialBalance = await token.balanceOf(addr1.address);
            
            await game.connect(addr1).buyTokens({ value: polAmount });
            
            expect(await token.balanceOf(addr1.address)).to.be.gt(initialBalance);
        });

        it("Should fail for non-signed up users", async function () {
            await expect(game.connect(addr2).buyTokens({ value: ethers.parseEther("1") }))
                .to.be.revertedWithCustomError(game, "NotSignedUp");
        });

        it("Should fail with zero POL", async function () {
            await expect(game.connect(addr1).buyTokens({ value: 0 }))
                .to.be.revertedWithCustomError(game, "NoPolSent");
        });
    });

    describe("Totem Purchase", function () {
        beforeEach(async function () {
            await game.connect(addr1).signup();
            await token.connect(addr1).approve(await game.getAddress(), gameParams.mintPrice);
        });

        it("Should allow purchasing a totem", async function () {
            await game.connect(addr1).purchaseTotem(0); // First species
            expect(await nft.balanceOf(addr1.address)).to.equal(1n);
            
            const expectedBalance = gameParams.signupReward - gameParams.mintPrice;
            expect(await token.balanceOf(addr1.address)).to.equal(expectedBalance);
        });

        it("Should initialize action tracking for new totem", async function () {
            await game.connect(addr1).purchaseTotem(0);
            const tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);

            // Check tracking initialization for each action
            const actionTypes = [0, 1, 2]; // Feed, Train, Treat
            for (const actionType of actionTypes) {
                const tracking = await game.getActionTracking(tokenId, actionType);
                expect(tracking.dailyUses).to.equal(0n);
            }
        });
    });

    describe("Action Execution", function () {
        let tokenId;

        beforeEach(async function () {
            // Setup user
            await game.connect(addr1).signup();
            
            // Approve tokens for both purchase and actions
            const totalApproval = gameParams.mintPrice + ethers.parseUnits("1000", 18); // Mint + actions
            await token.connect(addr1).approve(await game.getAddress(), totalApproval);
            
            // Purchase totem
            await game.connect(addr1).purchaseTotem(0);
            tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);

        });

        it("Should execute feed action", async function () {
            await game.connect(addr1).feed(tokenId);
            const tracking = await game.getActionTracking(tokenId, 0);
            expect(tracking.dailyUses).to.equal(1n);
        });

        it("Should respect time limits", async function () {
            // Check initial state
            const feedActionType = 0; // Feed action type
            const canUse = await game.canUseAction(tokenId, feedActionType);
            expect(canUse).to.be.true;

            // Execute feed action 
            await game.connect(addr1).feed(tokenId);
            const tracking = await game.getActionTracking(tokenId, feedActionType);
            expect(tracking.dailyUses).to.equal(BigInt(1));

            // Should fail on 4th attempt
            await expect(game.connect(addr1).feed(tokenId))
                .to.be.revertedWithCustomError(game, "ActionNotAvailable");
        });

        it("Should enforce happiness requirements for training", async function () {
            const trainActionType = 1; // Train action type
            
            // Initial attributes show happiness of 100
            const initialAttrs = await nft.attributes(tokenId);
            expect(initialAttrs[3]).to.equal(50n); // Initial happiness is 50
            
            // First we can train since happiness > 20
            await game.connect(addr1).train(tokenId);
            
            // Train multiple times to reduce happiness
            // Training costs 10 happiness each time
            for(let i = 0; i < 3; i++) { // Train 3 more times to reduce happiness below 20
                await game.connect(addr1).train(tokenId);
            }
            
            // Check happiness is now below training requirement
            const lowAttrs = await nft.attributes(tokenId);
            expect(lowAttrs[3]).to.be.lessThan(20n);
            
            // Training should now fail due to low happiness
            await expect(game.connect(addr1).train(tokenId))
                .to.be.revertedWithCustomError(game, "ActionNotAvailable");

            const latestBlock = await time.latest();
            const dayStart = Math.floor(latestBlock / 86400) * 86400;
            let targetTime = dayStart + 28800; // 08:00 UTC
            
            // Ensure we're not going backwards
            if (targetTime <= latestBlock) {
                targetTime += 86400; // Move to the next day
            }
            
            await time.increaseTo(targetTime + 1); // Ensure the block is valid
            
            // Feed to increase happiness
            await game.connect(addr1).feed(tokenId);
            
            // Check happiness has increased
            const finalAttrs = await nft.attributes(tokenId);
            expect(finalAttrs[3]).to.be.gte(20n);
            
            // Should now be able to train again
            await game.connect(addr1).train(tokenId);
        });

        it("Should enforce cooldown for treats", async function () {
            await game.connect(addr1).treat(tokenId);

            // Try to treat again immediately
            await expect(game.connect(addr1).treat(tokenId))
                .to.be.revertedWithCustomError(game, "ActionNotAvailable");
        });
    });

    describe("Admin Functions", function () {
        it("Should allow updating game parameters", async function () {
            const newParams = {
                signupReward: ethers.parseUnits("1000", 18),
                mintPrice: ethers.parseUnits("300", 18)
            };

            await game.updateGameParameters(newParams);
            const params = await game.gameParams();
            expect(params.signupReward).to.equal(newParams.signupReward);
            expect(params.mintPrice).to.equal(newParams.mintPrice);
        });

        it("Should allow updating action configs", async function () {
            const newConfig = {
                cost: ethers.parseUnits("15", 18),
                cooldown: 0n,
                maxDaily: 5n,
                minHappiness: 0n,
                happinessChange: 15n,
                experienceGain: 0n,
                useTimeWindows: true,
                increasesHappiness: true,
                enabled: true
            };

            await game.updateActionConfig(0, newConfig); // Update Feed config
            const updatedConfig = await game.actionConfigs(0);
            expect(updatedConfig.cost).to.equal(newConfig.cost);
            expect(updatedConfig.maxDaily).to.equal(newConfig.maxDaily);
            expect(updatedConfig.happinessChange).to.equal(newConfig.happinessChange);
        });
    });
});