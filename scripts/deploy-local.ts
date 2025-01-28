import { ethers } from "hardhat";
import { saveDeployment } from "./helpers";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
    console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

    // 1a. Deploy TotemAdminPriceOracle
    console.log("\nDeploying TotemAdminPriceOracle...");
    const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle");
    const initialPrice = ethers.parseUnits("0.01", "ether"); // Initial price 0.01 POL
    const adminOracle = await TotemAdminPriceOracle.deploy(initialPrice);
    await adminOracle.waitForDeployment();
    const oracleAddress = await adminOracle.getAddress();
    console.log("TotemAdminPriceOracle deployed to:", oracleAddress);

    // 1b. Deploy TotemToken
    console.log("\nDeploying TotemToken...");
    const TotemToken = await ethers.getContractFactory("TotemToken");
    const totemToken = await TotemToken.deploy(oracleAddress);
    await totemToken.waitForDeployment();
    const tokenAddress = await totemToken.getAddress();
    console.log("TotemToken deployed to:", tokenAddress);

    // 2. Deploy TotemNFT
    console.log("\nDeploying TotemNFT...");
    const TotemNFT = await ethers.getContractFactory("TotemNFT");
    const totemNFT = await TotemNFT.deploy();
    await totemNFT.waitForDeployment();
    const nftAddress = await totemNFT.getAddress();
    console.log("TotemNFT deployed to:", nftAddress);

    // 3. Deploy TotemTrustedForwarder
    console.log("\nDeploying TotemTrustedForwarder...");
    const TotemTrustedForwarder = await ethers.getContractFactory("TotemTrustedForwarder");
    const maxGasPrice = ethers.parseUnits("100", "gwei");
    const forwarder = await TotemTrustedForwarder.deploy(maxGasPrice);
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log("TotemTrustedForwarder deployed to:", forwarderAddress);

    // 4. Deploy ProxyAdmin
    console.log("\nDeploying ProxyAdmin...");
    const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
    const proxyAdmin = await TotemProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("ProxyAdmin deployed to:", proxyAdminAddress);

    // 5. Deploy Game Implementation
    console.log("\nDeploying Game Implementation...");
    const TotemGame = await ethers.getContractFactory("TotemGame");
    const gameImplementation = await TotemGame.deploy();
    await gameImplementation.waitForDeployment();
    const gameImplementationAddress = await gameImplementation.getAddress();
    console.log("Game Implementation deployed to:", gameImplementationAddress);

    // 6. Prepare initialization data for proxy
    const initialGameParams = {
        signupReward: ethers.parseUnits("2000", 18),  // 2000 TOTEM
        mintPrice: ethers.parseUnits("500", 18),      // 500 TOTEM
        feedCost: ethers.parseUnits("10", 18),        // 10 TOTEM
        trainCost: ethers.parseUnits("20", 18),       // 20 TOTEM
        feedHappinessIncrease: 10,
        trainExperienceIncrease: 50,
        trainHappinessDecrease: 10
    };    
    const initialTimeWindows = {
        window1Start: 0,      // 00:00 UTC
        window2Start: 28800,  // 08:00 UTC
        window3Start: 57600   // 16:00 UTC
    };    
    const initData = TotemGame.interface.encodeFunctionData("initialize", [
        tokenAddress,
        nftAddress,
        forwarderAddress,
        initialGameParams,
        initialTimeWindows
    ]);

    // 7. Deploy Proxy
    console.log("\nDeploying Proxy...");
    const TotemProxy = await ethers.getContractFactory("TotemProxy");
    const proxy = await TotemProxy.deploy(
        gameImplementationAddress,
        proxyAdminAddress,
        initData
    );
    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();
    console.log("Proxy deployed to:", proxyAddress);

    // 8. Set up Game Contract interface
    const gameContract = await ethers.getContractAt("TotemGame", proxyAddress);

    // 9. Setup Token Contract
    console.log("\nSetting up Token Contract...");
    const setProxyTx = await totemToken.updateGameProxy(proxyAddress);
    await setProxyTx.wait();
    const transferTx = await totemToken.transferGameplayAllocation();
    await transferTx.wait();
    console.log("Gameplay tokens transferred to proxy");

    // 10. Transfer NFT ownership to Game Contract
    console.log("\nTransferring NFT ownership...");
    const transferOwnershipTx = await totemNFT.transferOwnership(proxyAddress);
    await transferOwnershipTx.wait();
    console.log("NFT ownership transferred to proxy");
    
    // 11. Fund Forwarder with POL
    console.log("\nSetting proxy address in forwarder...");
    const setForwarderTx = await forwarder.setTargetContract(proxyAddress);
    await setForwarderTx.wait();
    console.log("\nFunding Forwarder with POL...");
    const fundTx = await deployer.sendTransaction({
        to: forwarderAddress,
        value: ethers.parseEther("1")
    });
    await fundTx.wait();
    console.log("Forwarder funded with 1 POL");

    // Save deployment info
    console.log("\nSaving deployment info...");
    const deploymentInfo = {
        network: "localhost",
        priceOracle: oracleAddress,
        totemToken: tokenAddress,
        totemNFT: nftAddress,
        totemTrustedForwarder: forwarderAddress,
        proxyAdmin: proxyAdminAddress,
        gameImplementation: gameImplementationAddress,
        gameProxy: proxyAddress,
        deployer: deployer.address
    };
    saveDeployment("localhost", deploymentInfo);

    // Verify setup
    console.log("\nVerifying setup...");
    const proxyBalance = await ethers.provider.getBalance(proxyAddress);
    const forwarderBalance = await ethers.provider.getBalance(forwarderAddress);
    const tokenBalance = await totemToken.balanceOf(proxyAddress);
    console.log("Game Proxy TOTEM Balance:", ethers.formatEther(tokenBalance));
    console.log("Game Proxy POL Balance:", ethers.formatEther(proxyBalance));
    console.log("Forwarder POL Balance:", ethers.formatEther(forwarderBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
