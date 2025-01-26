import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Upgrading contract with:", deployer.address);

    // Address from previous deployment
    const PROXY_ADDRESS = "YOUR_PROXY_ADDRESS";
    const PROXY_ADMIN_ADDRESS = "YOUR_PROXY_ADMIN_ADDRESS";
    
    // Deploy new implementation
    console.log("\nDeploying new Game Implementation...");
    const TotemGameV2 = await ethers.getContractFactory("TotemGame");
    const newImplementation = await TotemGameV2.deploy();
    await newImplementation.waitForDeployment();
    const newImplementationAddress = await newImplementation.getAddress();
    console.log("New implementation deployed to:", newImplementationAddress);

    // Get ProxyAdmin instance
    const proxyAdmin = await ethers.getContractAt("TotemProxyAdmin", PROXY_ADMIN_ADDRESS);

    // Upgrade proxy to new implementation
    console.log("\nUpgrading proxy...");
    const upgradeTx = await proxyAdmin.upgradeAndCall(
        PROXY_ADDRESS,
        newImplementationAddress,
        "0x" // No initialization data needed for upgrade
    );
    await upgradeTx.wait();
    console.log("Proxy upgraded successfully");

    // Get game contract instance at proxy address to verify upgrade
    const gameContract = await ethers.getContractAt("TotemGame", PROXY_ADDRESS);
    
    // Verify some state or new functionality
    console.log("\nVerifying upgrade...");
    const proxyBalance = await ethers.provider.getBalance(PROXY_ADDRESS);
    console.log("Proxy balance maintained:", ethers.formatEther(proxyBalance), "POL");

    console.log("\nUpgrade complete! New implementation is active at proxy:", PROXY_ADDRESS);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
    