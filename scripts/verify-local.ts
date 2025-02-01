// verify-local.ts
import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";

async function main() {
    const deployment = loadDeployment("localhost");
    
    // Get contract instances - updated with new proxy addresses
    const forwarder = await ethers.getContractAt("TotemTrustedForwarder", deployment.totemTrustedForwarder);
    const game = await ethers.getContractAt("TotemGame", deployment.gameProxy);
    const token = await ethers.getContractAt("TotemToken", deployment.tokenProxy); // Changed from totemToken
    const nft = await ethers.getContractAt("TotemNFT", deployment.totemNFT);

    console.log("\nVerifying contract setup...");
    
    // 1. Check forwarder target
    const target = await forwarder.targetContract();
    console.log("Forwarder target contract:", target);
    console.log("Expected target (game proxy):", deployment.gameProxy);
    
    if (target.toLowerCase() !== deployment.gameProxy.toLowerCase()) {
        console.log("Setting correct target contract...");
        const tx = await forwarder.setTargetContract(deployment.gameProxy);
        await tx.wait();
        console.log("Target contract updated");
    }
    
    // 2. Verify game contract's trusted forwarder
    const gameTrustedForwarder = await game.trustedForwarder();
    console.log("\nGame trusted forwarder:", gameTrustedForwarder);
    console.log("Expected forwarder:", deployment.totemTrustedForwarder);
    
    if (gameTrustedForwarder.toLowerCase() !== deployment.totemTrustedForwarder.toLowerCase()) {
        throw new Error("Game contract's trusted forwarder mismatch!");
    }
    
    // 3. Check contract owners
    const [deployer] = await ethers.getSigners();
    console.log("\nVerifying contract owners...");
     
    const gameOwner = await game.owner();
    console.log("Game owner:", gameOwner);
    console.log("Expected game owner:", deployer.address);
    if (gameOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error("Game owner mismatch!");
    }

    const tokenOwner = await token.owner();
    console.log("\nToken owner:", tokenOwner);
    console.log("Expected token owner:", deployer.address);
    if (tokenOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error("Token owner mismatch!");
    }

    const nftOwner = await nft.owner();
    console.log("\nNFT owner:", nftOwner);
    console.log("Expected NFT owner:", deployment.gameProxy);
    if (nftOwner.toLowerCase() !== deployment.gameProxy.toLowerCase()) {
        throw new Error("NFT owner mismatch!");
    }

    // Add verification of proxy admin ownership
    const proxyAdmin = await ethers.getContractAt("TotemProxyAdmin", deployment.proxyAdmin);
    const proxyAdminOwner = await proxyAdmin.owner();
    console.log("\nProxy Admin owner:", proxyAdminOwner);
    console.log("Expected Proxy Admin owner:", deployer.address);
    if (proxyAdminOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error("Proxy Admin owner mismatch!");
    }

    // 4. Check forwarder POL balance
    const balance = await ethers.provider.getBalance(deployment.totemTrustedForwarder);
    console.log("\nForwarder POL balance:", ethers.formatEther(balance));
    
    if (balance < ethers.parseEther("0.1")) {
        console.log("Warning: Low forwarder POL balance");
    }

    console.log("\nSetup verification complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });