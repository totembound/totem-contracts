const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemGame", function () {
    let TotemGame, TotemToken, TotemNFT, TotemProxy, TotemProxyAdmin;
    let game, token, nft, proxy, proxyAdmin, adminOracle;
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

    // Action configurations
    const actionConfigs = {
        feed: {
            cost: ethers.parseUnits("10", 18),      // 10 TOTEM
            cooldown: 0n,
            maxDaily: 3n,
            minHappiness: 0n,
            happinessChange: 10n,
            experienceGain: 0n,
            useTimeWindows: true,
            increasesHappiness: true,
            enabled: true
        },
        train: {
            cost: ethers.parseUnits("20", 18),      // 20 TOTEM
            cooldown: 0n,
            maxDaily: 0n,
            minHappiness: 20n,
            happinessChange: 10n,
            experienceGain: 50n,
            useTimeWindows: false,
            increasesHappiness: false,
            enabled: true
        },
        treat: {
            cost: ethers.parseUnits("20", 18),      // 20 TOTEM
            cooldown: 14400n,
            maxDaily: 2n,
            minHappiness: 0n,
            happinessChange: 10n,
            experienceGain: 0n,
            useTimeWindows: false,
            increasesHappiness: true,
            enabled: true
        }
    };

    beforeEach(async function () {
        [owner, addr1, addr2, trustedForwarder] = await ethers.getSigners();

        // 1. Deploy price oracle
        const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
        const initialPrice = ethers.parseUnits("0.01", "ether");
        adminOracle = await TotemAdminPriceOracle.deploy(initialPrice);

        // 2. Deploy TotemToken
        TotemToken = await ethers.getContractFactory("TotemToken");
        token = await TotemToken.deploy(await adminOracle.getAddress());

        // 3. Deploy TotemNFT
        TotemNFT = await ethers.getContractFactory("TotemNFT");
        nft = await TotemNFT.deploy();

        // 4. Deploy ProxyAdmin
        TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
        proxyAdmin = await TotemProxyAdmin.deploy(owner.address);

        // 5. Deploy Game Implementation
        TotemGame = await ethers.getContractFactory("TotemGame");
        const gameImplementation = await TotemGame.deploy();

        // 6. Prepare initialization data
        const initData = TotemGame.interface.encodeFunctionData("initialize", [
            await token.getAddress(),
            await nft.getAddress(),
            trustedForwarder.address,
            {
                signupReward: gameParams.signupReward,
                mintPrice: gameParams.mintPrice
            },
            {
                window1Start: timeWindows.window1Start,
                window2Start: timeWindows.window2Start,
                window3Start: timeWindows.window3Start
            }
        ]);

        // 7. Deploy Proxy
        TotemProxy = await ethers.getContractFactory("TotemProxy");
        proxy = await TotemProxy.deploy(
            await gameImplementation.getAddress(),
            await proxyAdmin.getAddress(),
            initData
        );

        // 8. Set up Game Contract interface
        game = await ethers.getContractAt("TotemGame", await proxy.getAddress());

        // 9. Setup Token Contract
        await token.updateGameProxy(await game.getAddress());
        await token.transferGameplayAllocation();

        // 10. Transfer NFT ownership
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

        it("Should have correct token balance after initialization", async function () {
            const gameplayTokens = (ethers.parseUnits("1000000000", 18) * 25n) / 100n; // 25% of 1 billion
            expect(await token.balanceOf(await game.getAddress())).to.equal(gameplayTokens);
        });

        it("Should have correct action configurations", async function () {
            const { params, windows, configs } = await game.getGameConfiguration();

            // Verify game parameters
            expect(params.signupReward).to.equal(gameParams.signupReward);
            expect(params.mintPrice).to.equal(gameParams.mintPrice);

            // Verify action configurations
            const actionTypes = ['Feed', 'Train', 'Treat'];
            actionTypes.forEach((actionType, index) => {
                const actionConfig = configs[index];
                let expectedConfig;
                switch(actionType) {
                    case 'Feed':
                        expectedConfig = actionConfigs.feed;
                        break;
                    case 'Train':
                        expectedConfig = actionConfigs.train;
                        break;
                    case 'Treat':
                        expectedConfig = actionConfigs.treat;
                        break;
                }

                expect(actionConfig.cost).to.equal(expectedConfig.cost);
                expect(actionConfig.cooldown).to.equal(expectedConfig.cooldown);
                expect(actionConfig.maxDaily).to.equal(expectedConfig.maxDaily);
                expect(actionConfig.minHappiness).to.equal(expectedConfig.minHappiness);
                expect(actionConfig.happinessChange).to.equal(expectedConfig.happinessChange);
                expect(actionConfig.experienceGain).to.equal(expectedConfig.experienceGain);
                expect(actionConfig.useTimeWindows).to.equal(expectedConfig.useTimeWindows);
                expect(actionConfig.increasesHappiness).to.equal(expectedConfig.increasesHappiness);
                expect(actionConfig.enabled).to.equal(expectedConfig.enabled);
            });
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

    describe("Token Buying", function () {
        beforeEach(async function () {
            await game.connect(addr1).signup();
        });

        it("Should allow buying tokens with POL", async function () {
            const polAmount = ethers.parseEther("1"); // 1 POL
            const initialBalance = await token.balanceOf(addr1.address);
            
            await game.connect(addr1).buyTokens({ value: polAmount });
            
            expect(await token.balanceOf(addr1.address)).to.be.gt(initialBalance);
        });

        it("Should fail buying tokens without signup", async function () {
            const polAmount = ethers.parseEther("1");
            await expect(game.connect(addr2).buyTokens({ value: polAmount }))
                .to.be.revertedWithCustomError(game, "NotSignedUp");
        });

        it("Should fail buying tokens with zero POL", async function () {
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
            const speciesId = 0; // First species
            await game.connect(addr1).purchaseTotem(speciesId);
            
            expect(await nft.balanceOf(addr1.address)).to.equal(1n);
            
            const expectedBalance = gameParams.signupReward - gameParams.mintPrice;
            expect(await token.balanceOf(addr1.address)).to.equal(expectedBalance);
        });

        it("Should fail to purchase with invalid species", async function () {
            const invalidSpeciesId = 255;
            await expect(game.connect(addr1).purchaseTotem(invalidSpeciesId))
                .to.be.revertedWithCustomError(nft, "InvalidSpecies");
        });

        it("Should fail to purchase without signup", async function () {
            await expect(game.connect(addr2).purchaseTotem(0))
                .to.be.revertedWithCustomError(game, "NotSignedUp");
        });

        it("Should fail to purchase without sufficient token approval", async function () {
            await token.connect(addr1).approve(await game.getAddress(), 0); // Reset approval
            await expect(game.connect(addr1).purchaseTotem(0))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        });
    });

    describe("Action Execution", function () {
        let tokenId;
        beforeEach(async function () {
            // Signup, purchase totem, and approve tokens
            await game.connect(addr1).signup();
            await token.connect(addr1).approve(await game.getAddress(), ethers.parseUnits("1000", 18));
            
            // Purchase a totem
            await game.connect(addr1).purchaseTotem(0);
            tokenId = await nft.tokenOfOwnerByIndex(addr1.address, 0);
        });

        it("Should allow feeding a totem", async function () {
            await game.connect(addr1).feed(tokenId);
        });

        it("Should allow training a totem", async function () {
            await game.connect(addr1).train(tokenId);
        });

        it("Should allow treating a totem", async function () {
            await game.connect(addr1).treat(tokenId);
        });
    });
});
