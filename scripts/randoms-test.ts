import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { mintAndAnalyzeDistribution, formatDistribution } from "./distributionHelper";

async function main() {
    // ... existing verification code ...
    const deployment = loadDeployment("localhost");
    const [deployer] = await ethers.getSigners();
    const nft = await ethers.getContractAt("TotemNFT", deployment.totemNFT);

    // Add NFT distribution analysis
    console.log("\nAnalyzing NFT distribution...");
    try {
        const distribution = await mintAndAnalyzeDistribution(nft, 100, deployer.address);
        console.log(formatDistribution(distribution));
    } catch (error) {
        console.error("Error analyzing NFT distribution:", error);
    }

    console.log("\nSetup verification complete!");
}
