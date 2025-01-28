import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);

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
    console.log("TotemToken deployed to:", await totemToken.getAddress());

    // 2. Deploy TotemNFT
    console.log("\nDeploying TotemNFT...");
    const TotemNFT = await ethers.getContractFactory("TotemNFT");
    const totemNFT = await TotemNFT.deploy();
    await totemNFT.waitForDeployment();
    console.log("TotemNFT deployed to:", await totemNFT.getAddress());

    // 3. Deploy ProxyAdmin
    console.log("\nDeploying ProxyAdmin...");
    const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin");
    const proxyAdmin = await TotemProxyAdmin.deploy(deployer.address);
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log("ProxyAdmin deployed to:", proxyAdminAddress);

    // 4. Deploy Game Implementation
    console.log("\nDeploying Game Implementation...");
    const TotemGame = await ethers.getContractFactory("TotemGame");
    const gameImplementation = await TotemGame.deploy();
    await gameImplementation.waitForDeployment();
    const gameImplementationAddress = await gameImplementation.getAddress();
    console.log("Game Implementation deployed to:", gameImplementationAddress);

    // 5. Prepare initialization data for proxy
    const initData = TotemGame.interface.encodeFunctionData("initialize", [
        await totemToken.getAddress(),
        await totemNFT.getAddress()
    ]);

    // 6. Deploy Proxy
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

    // 7. Set up Game Contract interface
    const gameContract = TotemGame.attach(proxyAddress);

    // 8. Setup Token Contract
    console.log("\nSetting up Token Contract...");
    await totemToken.updateGameProxy(proxyAddress);
    await totemToken.transferGameplayAllocation();
    console.log("Gameplay tokens transferred to proxy");

    // 9. Transfer NFT ownership to Game Contract
    console.log("\nTransferring NFT ownership...");
    await totemNFT.transferOwnership(proxyAddress);
    console.log("NFT ownership transferred to proxy");

    // Log all deployed addresses
    console.log("\nDEPLOYMENT COMPLETE! Contract addresses:");
    console.log("======================================");
    console.log("TotemToken:", await totemToken.getAddress());
    console.log("TotemNFT:", await totemNFT.getAddress());
    console.log("ProxyAdmin:", proxyAdminAddress);
    console.log("Game Implementation:", gameImplementationAddress);
    console.log("Game Proxy:", proxyAddress);

    // Verify setup
    console.log("\nVerifying setup...");
    const proxyBalance = await ethers.provider.getBalance(proxyAddress);
    const tokenBalance = await totemToken.balanceOf(proxyAddress);
    console.log("Game Proxy TOTEM Balance:", ethers.formatEther(tokenBalance));
    console.log("Game Proxy POL Balance:", ethers.formatEther(proxyBalance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
