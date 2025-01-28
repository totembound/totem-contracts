const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TotemGame", function () {
    let TotemGame, TotemToken, TotemNFT, TotemProxy, TotemProxyAdmin;
    let game, token, nft, proxy, proxyAdmin, adminOracle;
    let owner, addr1, addr2, trustedForwarder;
    
    // Initial game parameters
    const gameParams = {
        signupReward: ethers.parseUnits("2000", 18),    // 2000 TOTEM
        mintPrice: ethers.parseUnits("500", 18),        // 500 TOTEM
        feedCost: ethers.parseUnits("10", 18),          // 10 TOTEM
        trainCost: ethers.parseUnits("20", 18),         // 20 TOTEM
        feedHappinessIncrease: 10n,
        trainExperienceIncrease: 50n,
        trainHappinessDecrease: 10n
    };

    // Time windows for feeding (in seconds from start of day UTC)
    const timeWindows = {
        window1Start: 0n,      // 00:00 UTC
        window2Start: 28800n,  // 08:00 UTC
        window3Start: 57600n   // 16:00 UTC
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
            [
                gameParams.signupReward,
                gameParams.mintPrice,
                gameParams.feedCost,
                gameParams.trainCost,
                gameParams.feedHappinessIncrease,
                gameParams.trainExperienceIncrease,
                gameParams.trainHappinessDecrease
            ],
            [
                timeWindows.window1Start,
                timeWindows.window2Start,
                timeWindows.window3Start
            ]
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
            expect(params.feedCost).to.equal(gameParams.feedCost);
            expect(params.trainCost).to.equal(gameParams.trainCost);
            expect(params.feedHappinessIncrease).to.equal(gameParams.feedHappinessIncrease);
            expect(params.trainExperienceIncrease).to.equal(gameParams.trainExperienceIncrease);
            expect(params.trainHappinessDecrease).to.equal(gameParams.trainHappinessDecrease);
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
                .to.be.revertedWith("Already signed up");
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
                .to.be.revertedWith("Must sign up first");
        });

        it("Should fail buying tokens with zero POL", async function () {
            await expect(game.connect(addr1).buyTokens({ value: 0 }))
                .to.be.revertedWith("Must send POL");
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
                .to.be.revertedWith("Invalid species");
        });

        it("Should fail to purchase without signup", async function () {
            await expect(game.connect(addr2).purchaseTotem(0))
                .to.be.revertedWith("Must sign up first");
        });

        it("Should fail to purchase without sufficient token approval", async function () {
            await token.connect(addr1).approve(await game.getAddress(), 0); // Reset approval
            await expect(game.connect(addr1).purchaseTotem(0))
                .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
        });
    });
});