import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemGame, TotemNFT, TotemToken } from "../typechain-types";

// Define enums to match the contract
enum Species {
    Goose,
    Otter,
    Wolf,
    Falcon,
    Beaver,
    Deer,
    Woodpecker,
    Salmon,
    Bear,
    Raven,
    Snake,
    Owl,
    None
}

enum Color {
    Brown,
    Gray,
    White,
    Tawny,
    Speckled,
    Russet,
    Slate,
    Copper,
    Cream,
    Dappled,
    Golden,
    DarkPurple,
    LightBlue,
    Charcoal,
    EmeraldGreen,
    CrimsonRed,
    DeepSapphire,
    RadiantGold,
    EtherealSilver,
    None
}

enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary
}

async function main() {
    const deployment = loadDeployment("localhost");
    console.log("Loading contracts...\n");

    // Get provider
    const provider = await ethers.provider;

    // Get contract instances with correct proxy addresses
    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as unknown as TotemGame;

    const nft = await ethers.getContractAt(
        "TotemNFT",
        deployment.totemNFT
    ) as unknown as TotemNFT;

    const token = await ethers.getContractAt(
        "TotemToken",
        deployment.tokenProxy  // Updated to use tokenProxy
    ) as unknown as TotemToken;

    // Get proxy admin info
    const proxyAdmin = await ethers.getContractAt("TotemProxyAdmin", deployment.proxyAdmin);
    console.log("=== Proxy Information ===");
    console.log(`Token Implementation: ${deployment.tokenImplementation}`);
    console.log(`Game Implementation: ${deployment.gameImplementation}`);
    console.log(`Rewards Implementation: ${deployment.rewardsImplementation}`);
    console.log(`ProxyAdmin Owner: ${await proxyAdmin.owner()}\n`);

    // Token Allocation Stats
    console.log("=== Token Allocations ===");
    const categories = ['Game', 'Rewards', 'Ecosystem', 'Liquidity', 'Marketing', 'Team', 'Reserved'];
    for (let i = 0; i < categories.length; i++) {
        const remaining = await token.getRemainingAllocation(i);
        console.log(`${categories[i]}: ${ethers.formatEther(remaining)} TOTEM remaining`);
    }

    // Existing user signup stats...
    console.log("\n=== Signed Up Users & Balances ===");
    const filter = game.filters.UserSignedUp();
    const events = await game.queryFilter(filter);
    console.log(`Total users: ${events.length}\n`);

    // Get game parameters
    const gameParams = await game.gameParams();
    console.log("=== Game Parameters ===");
    console.log(`Signup Reward: ${ethers.formatEther(gameParams.signupReward)} TOTEM`);
    console.log(`Mint Price: ${ethers.formatEther(gameParams.mintPrice)} TOTEM`);

    // Get action configs
    console.log("\n=== Action Configurations ===");
    const actionTypes = ['Feed', 'Train', 'Treat'];
    for (let i = 0; i < actionTypes.length; i++) {
        const config = await game.actionConfigs(i);
        console.log(`\n${actionTypes[i]} Action:`);
        console.log(`Cost: ${ethers.formatEther(config.cost)} TOTEM`);
        console.log(`Max Daily Uses: ${config.maxDaily}`);
        console.log(`Happiness Change: ${config.happinessChange}`);
        console.log(`Experience Gain: ${config.experienceGain}`);
        console.log(`Enabled: ${config.enabled}`);
    }

    // Contract balances with more detail
    const gameBalance = await token.balanceOf(deployment.gameProxy);
    const rewardsBalance = await token.balanceOf(deployment.rewardsProxy);
    const forwarderBalance = await provider.getBalance(deployment.totemTrustedForwarder);
    const tokenContractBalance = await token.balanceOf(deployment.tokenProxy);
    
    console.log("\n=== Contract Balances ===");
    console.log(`Game Proxy TOTEM Balance: ${ethers.formatEther(gameBalance)} TOTEM`);
    console.log(`Rewards Proxy TOTEM Balance: ${ethers.formatEther(rewardsBalance)} TOTEM`);
    console.log(`Token Proxy TOTEM Balance: ${ethers.formatEther(tokenContractBalance)} TOTEM`);
    console.log(`Forwarder POL Balance: ${ethers.formatEther(forwarderBalance)} POL`);

    // NFT Stats with more metrics
    const totalSupply = await nft.totalSupply();
    console.log("\n=== NFT Statistics ===");
    console.log(`Total NFTs: ${totalSupply}`);

    // Track NFT metrics
    const speciesCount = new Array(13).fill(0);
    const rarityCount = new Array(5).fill(0);
    const stageCount = new Array(5).fill(0);

    // Existing NFT iteration with added metrics...
    for (let i = 1; i <= totalSupply; i++) {
        const tokenId = i;
        try {
            const attrs = await nft.attributes(tokenId);
            speciesCount[Number(attrs.species)]++;
            rarityCount[Number(attrs.rarity)]++;
            stageCount[Number(attrs.stage)]++;
            // Rest of the NFT details...
        } catch (error) {
            console.error(`Error fetching token ${tokenId}:`, error);
        }
    }

    // Print NFT metrics
    console.log("\n=== NFT Metrics ===");
    console.log("Species Distribution:");
    speciesCount.forEach((count, index) => {
        if (index < 12) console.log(`${Species[index]}: ${count}`);
    });

    console.log("\nRarity Distribution:");
    rarityCount.forEach((count, index) => {
        console.log(`${Rarity[index]}: ${count}`);
    });

    console.log("\nStage Distribution:");
    stageCount.forEach((count, index) => {
        console.log(`Stage ${index}: ${count}`);
    });

    // Keep existing token stats and top holders...
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
