import { ethers } from "hardhat";
import { saveDeployment } from "./helpers";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // Deploy TotemAdminPriceOracle
    console.log("\nDeploying TotemAdminPriceOracle...");
    const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
    const initialPrice = ethers.parseUnits("0.01", "ether"); // Initial price 0.01 POL
    const adminOracle = await TotemAdminPriceOracle.deploy(initialPrice);
    await adminOracle.waitForDeployment();
    const oracleAddress = await adminOracle.getAddress();
    console.log("TotemAdminPriceOracle deployed to:", oracleAddress);

    // Deploy Token Implementation
    console.log("\nDeploying Token Implementation...");
    const TotemToken = await ethers.getContractFactory("TotemToken");
    const tokenImplementation = await TotemToken.deploy();
    await tokenImplementation.waitForDeployment();
    const tokenImplementationAddress = await tokenImplementation.getAddress();
    console.log("Token Implementation deployed to:", tokenImplementationAddress);

    // Deploy TotemNFT
    console.log("\nDeploying TotemNFT...");
    const TotemNFT = await ethers.getContractFactory("TotemNFT");
    const nftImplementation = await TotemNFT.deploy();
    await nftImplementation.waitForDeployment();
    const nftImplementationAddress = await nftImplementation.getAddress();
    console.log("TotemNFT deployed to:", nftImplementationAddress);

    // Deploy MockRandomOracle for local development
    console.log("\nDeploying MockRandomOracle...");
    const MockRandomOracle = await ethers.getContractFactory("MockRandomOracle");
    const mockRandomOracle = await MockRandomOracle.deploy();
    await mockRandomOracle.waitForDeployment();
    const mockRandomOracleAddress = await mockRandomOracle.getAddress();
    console.log("MockRandomOracle deployed to:", mockRandomOracleAddress);

    // Deploy TotemTrustedForwarder
    console.log("\nDeploying TotemTrustedForwarder...");
    const TotemTrustedForwarder = await ethers.getContractFactory("TotemTrustedForwarder");
    const maxGasPrice = ethers.parseUnits("100", "gwei");
    const forwarder = await TotemTrustedForwarder.deploy(maxGasPrice);
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log("TotemTrustedForwarder deployed to:", forwarderAddress);

    // Deploy ProxyAdmin, used for TotemToken, TotemGame and TotemRewards
    console.log("\nDeploying ProxyAdmin...");
    const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
    const proxyAdmin = await TotemProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("ProxyAdmin deployed to:", proxyAdminAddress);

    const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
        oracleAddress
    ]);

    // Deploy Proxy for TotemToken
    console.log("\nDeploying Token Proxy...");
    const TotemProxy = await ethers.getContractFactory("TotemProxy");
    const tokenProxy = await TotemProxy.deploy(
        tokenImplementationAddress,
        proxyAdminAddress,
        initTokenData
    );
    await tokenProxy.waitForDeployment();
    const tokenProxyAddress = await tokenProxy.getAddress();
    console.log("Token Proxy deployed to:", tokenProxyAddress);

    const initNFTData = TotemNFT.interface.encodeFunctionData("initialize", [
    ]);

    // Deploy Proxy for TotemNFT
    console.log("\nDeploying NFT Proxy...");
    const nftProxy = await TotemProxy.deploy(
        nftImplementationAddress,
        proxyAdminAddress,
        initNFTData
    );
    await nftProxy.waitForDeployment();
    const nftProxyAddress = await nftProxy.getAddress();
    console.log("NFT Proxy deployed to:", nftProxyAddress);

    // Deploy Game Implementation
    console.log("\nDeploying Game Implementation...");
    const TotemGame = await ethers.getContractFactory("TotemGame");
    const gameImplementation = await TotemGame.deploy();
    await gameImplementation.waitForDeployment();
    const gameImplementationAddress = await gameImplementation.getAddress();
    console.log("Game Implementation deployed to:", gameImplementationAddress);
    //Prepare Game initialization data for proxy
    const initialGameParams = {
        signupReward: ethers.parseUnits("2000", 18),  // 2000 TOTEM
        mintPrice: ethers.parseUnits("500", 18)       // 500 TOTEM
    };    
    const initialTimeWindows = {
        window1Start: 0,      // 00:00 UTC
        window2Start: 28800,  // 08:00 UTC
        window3Start: 57600   // 16:00 UTC
    };    
    const initGameData = TotemGame.interface.encodeFunctionData("initialize", [
        tokenProxyAddress,
        nftProxyAddress,
        forwarderAddress,
        initialGameParams,
        initialTimeWindows
    ]);

    // Deploy Proxy for TotemGame
    console.log("\nDeploying Game Proxy...");
    const gameProxy = await TotemProxy.deploy(
        gameImplementationAddress,
        proxyAdminAddress,
        initGameData
    );
    await gameProxy.waitForDeployment();
    const gameProxyAddress = await gameProxy.getAddress();
    console.log("Game Proxy deployed to:", gameProxyAddress);

    // Deploy Rewards Implementation
    console.log("\nDeploying Rewards Implementation...");
    const TotemRewards = await ethers.getContractFactory("TotemRewards");
    const rewardsImplementation = await TotemRewards.deploy();
    await rewardsImplementation.waitForDeployment();
    const rewardsImplementationAddress = await rewardsImplementation.getAddress();
    console.log("Rewards Implementation deployed to:", rewardsImplementationAddress);
    // Prepare Rewards initialization data
    const initRewardsData = TotemRewards.interface.encodeFunctionData("initialize", [
        tokenProxyAddress,
        forwarderAddress
    ]);

    // Deploy Proxy for TotemRewards
    console.log("\nDeploying Rewards Proxy...");
    const rewardsProxy = await TotemProxy.deploy(
        rewardsImplementationAddress,
        proxyAdminAddress,
        initRewardsData
    );
    await rewardsProxy.waitForDeployment();
    const rewardsProxyAddress = await rewardsProxy.getAddress();
    console.log("Rewards Proxy deployed to:", rewardsProxyAddress);

    // Deploy Achievements Implementation
    console.log("\nDeploying Achievements Implementation...");
    const TotemAchievements = await ethers.getContractFactory("TotemAchievements");
    const achievementsImplementation = await TotemAchievements.deploy();
    await achievementsImplementation.waitForDeployment();
    const achievementsImplementationAddress = await achievementsImplementation.getAddress();
    console.log("Achievements Implementation deployed to:", achievementsImplementationAddress);
    // Prepare Achievements initialization data
    const initAchievementsData = TotemAchievements.interface.encodeFunctionData("initialize", [
    ]);

    // Deploy Proxy for TotemAchievements
    console.log("\nDeploying Achievements Proxy...");
    const achievementsProxy = await TotemProxy.deploy(
        achievementsImplementationAddress,
        proxyAdminAddress,
        initAchievementsData
    );
    await achievementsProxy.waitForDeployment();
    const achievementsProxyAddress = await achievementsProxy.getAddress();
    console.log("Achievements Proxy deployed to:", achievementsProxyAddress);

    // Setup Achievements authorized contracts; TotemNFT, TotemGame, TotemRewards
    console.log("\nAuthorizing contracts to interact with achievements...");
    const achievements = await ethers.getContractAt("TotemAchievements", achievementsProxyAddress);
    // Authorize TotemNFT
    console.log("Authorizing TotemNFT...");
    const authNftTx = await achievements.authorize(nftProxyAddress);
    await authNftTx.wait();
    const totemNFT = await ethers.getContractAt("TotemNFT", nftProxyAddress);
    await totemNFT.setAchievements(achievementsProxyAddress);
    console.log("TotemNFT authorized");

    // Authorize TotemGame
    console.log("Authorizing TotemGame...");
    const authGameTx = await achievements.authorize(gameProxyAddress);
    await authGameTx.wait();
    const totemGame = await ethers.getContractAt("TotemGame", gameProxyAddress);
    await totemGame.setAchievements(achievementsProxyAddress);
    console.log("TotemGame authorized");

    // Authorize TotemRewards
    console.log("Authorizing TotemRewards...");
    const authRewardsTx = await achievements.authorize(rewardsProxyAddress);
    await authRewardsTx.wait();
    const totemRewards = await ethers.getContractAt("TotemGame", gameProxyAddress);
    await totemRewards.setAchievements(achievementsProxyAddress);
    console.log("TotemRewards authorized");

    // Setup random oracle in NFT contract
    console.log("\nSetting random oracle in NFT contract...");
    const setRandomOracleTx = await totemNFT.setRandomOracle(mockRandomOracleAddress);
    await setRandomOracleTx.wait();
    console.log("Random oracle set in NFT contract");

    // Setup Token Contract: fund and transfer tokens
    console.log("\nSetting up Token Contract...");
    enum AllocationCategory {
        Game,
        Rewards,
        Reserved,
        Marketing,
        Liquidity,
        Team
    }

    // Fund Game Contract, transfer TOTEM
    const totemToken = await ethers.getContractAt("TotemToken", tokenProxyAddress);
    const gameAllocation = ethers.parseUnits("250000000", 18);
    const gameAllocationTx = await totemToken.transferAllocation(
        AllocationCategory.Game,
        gameProxyAddress,
        gameAllocation
    );
    await gameAllocationTx.wait();
    console.log("Game allocated with TOTEM tokens");

    // Fund Rewards Contract, transfer TOTEM
    const rewardsAllocation = ethers.parseUnits("150000000", 18);
    const rewardsAllocationTx = await totemToken.transferAllocation(
        AllocationCategory.Rewards,
        rewardsProxyAddress,
        rewardsAllocation
    );
    await rewardsAllocationTx.wait();
    console.log("Rewards allocated with TOTEM tokens");

    // Transfer NFT ownership to Game Contract
    console.log("\nTransferring NFT ownership...");
    const transferOwnershipTx = await totemNFT.transferOwnership(gameProxyAddress);
    await transferOwnershipTx.wait();
    console.log("NFT ownership transferred to proxy");
    
    // Set up Forwarder, transfer POL
    console.log("\nSetting proxy address in forwarder...");
    const setForwarderTx = await forwarder.setTargetContract(gameProxyAddress);
    await setForwarderTx.wait();
    console.log("\nFunding Forwarder with POL...");
    const fundForwarderTx = await deployer.sendTransaction({
        to: forwarderAddress,
        value: ethers.parseEther("1")
    });
    await fundForwarderTx.wait();
    console.log("Forwarder funded with 1 POL");

    // Save deployment info
    console.log("\nSaving deployment info...");
    const deploymentInfo = {
        network: "localhost",
        priceOracle: oracleAddress,
        tokenImplementation: tokenImplementationAddress,
        tokenProxy: tokenProxyAddress,
        totemNFT: nftImplementationAddress,
        totemNFTProxy: nftProxyAddress,
        totemTrustedForwarder: forwarderAddress,
        proxyAdmin: proxyAdminAddress,
        gameImplementation: gameImplementationAddress,
        gameProxy: gameProxyAddress,
        rewardsImplementation: rewardsImplementationAddress,
        rewardsProxy: rewardsProxyAddress,
        achievementsImplementation: achievementsImplementationAddress,
        achievementsProxy: achievementsProxyAddress,
        deployer: deployer.address
    };
    saveDeployment("localhost", deploymentInfo);

    // Verify setup
    console.log("\nVerifying setup...");
    const gameProxyBalance = await ethers.provider.getBalance(gameProxyAddress);
    const rewardsProxyBalance = await ethers.provider.getBalance(rewardsProxyAddress);
    const forwarderBalance = await ethers.provider.getBalance(forwarderAddress);
    const gameTotemBalance = await totemToken.balanceOf(gameProxyAddress);
    const rewardsTotemBalance = await totemToken.balanceOf(rewardsProxyAddress);
    const tokenTotemBalance = await totemToken.balanceOf(tokenProxyAddress);

    console.log("Forwarder POL Balance:", ethers.formatEther(forwarderBalance));
    console.log("Game Proxy TOTEM Balance:", ethers.formatEther(gameTotemBalance));
    console.log("Game Proxy POL Balance:", ethers.formatEther(gameProxyBalance));
    console.log("Rewards Proxy TOTEM Balance:", ethers.formatEther(rewardsTotemBalance));
    console.log("Rewards Proxy POL Balance:", ethers.formatEther(rewardsProxyBalance));
    console.log("Token TOTEM Balance:", ethers.formatEther(tokenTotemBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
