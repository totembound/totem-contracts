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

    // Get contract instances
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
        deployment.totemToken
    ) as unknown as TotemToken;

    // Get all UserSignedUp events from the beginning
    const filter = game.filters.UserSignedUp();
    const events = await game.queryFilter(filter);

    console.log("=== Signed Up Users & Balances ===");
    console.log(`Total users: ${events.length}\n`);

    // Track total TOTEM distributed
    let totalTokensDistributed = BigInt(0);

    for (const event of events) {
        const userAddress = event.args.user;
        const hasAccount = await game.hasAccount(userAddress);
        const tokenBalance = await token.balanceOf(userAddress);
        totalTokensDistributed += tokenBalance;

        console.log(`User: ${userAddress}`);
        console.log(`Block: ${event.blockNumber}`);
        console.log(`TX: ${event.transactionHash}`);
        console.log(`Has account: ${hasAccount}`);
        console.log(`TOTEM Balance: ${ethers.formatEther(tokenBalance)} TOTEM`);
        console.log("---");
    }

    // Contract balances
    const gameBalance = await token.balanceOf(deployment.gameProxy);
    const forwarderBalance = await provider.getBalance(deployment.totemTrustedForwarder);
    
    console.log("\n=== Contract Balances ===");
    console.log(`Game Contract TOTEM Balance: ${ethers.formatEther(gameBalance)} TOTEM`);
    console.log(`Forwarder POL Balance: ${ethers.formatEther(forwarderBalance)} POL`);
    console.log(`Total TOTEM Distributed to Users: ${ethers.formatEther(totalTokensDistributed)} TOTEM`);

    // Get all Totem NFTs
    const totalSupply = await nft.totalSupply();
    console.log("\n=== Totem NFTs ===");
    console.log(`Total NFTs: ${totalSupply}\n`);

    for (let i = 1; i <= totalSupply; i++) {
        const tokenId = i;
        try {
            const owner = await nft.ownerOf(tokenId);
            const attrs = await nft.attributes(tokenId);
            const ownerBalance = await token.balanceOf(owner);
            
            console.log(`Token ID: ${tokenId}`);
            console.log(`Owner: ${owner}`);
            console.log(`Owner TOTEM Balance: ${ethers.formatEther(ownerBalance)} TOTEM`);
            console.log("Attributes:", {
                species: Species[Number(attrs.species)],
                color: Color[Number(attrs.color)],
                rarity: Rarity[Number(attrs.rarity)],
                happiness: attrs.happiness.toString(),
                experience: attrs.experience.toString(),
                stage: attrs.stage.toString(),
                lastFed: new Date(Number(attrs.lastFed) * 1000).toISOString(),
                isStaked: attrs.isStaked,
                displayName: attrs.displayName.toString()
            });
            console.log("---");
        } catch (error) {
            console.error(`Error fetching token ${tokenId}:`, error);
        }
    }

    // Additional token stats
    console.log("\n=== Token Statistics ===");
    const totalSupplyTotem = await token.totalSupply();
    console.log(`Total TOTEM Supply: ${ethers.formatEther(totalSupplyTotem)} TOTEM`);
    
    // Top holders (unique addresses)
    const uniqueAddresses = [...new Set([
        ...events.map(e => e.args.user),
        deployment.gameProxy,
        deployment.totemToken
    ])];

    console.log("\n=== Top TOTEM Holders ===");
    const balances = await Promise.all(
        uniqueAddresses.map(async addr => ({
            address: addr,
            balance: await token.balanceOf(addr)
        }))
    );

    balances
        .sort((a, b) => Number(b.balance - a.balance))
        .slice(0, 10)
        .forEach(({ address, balance }) => {
            console.log(`${address}: ${ethers.formatEther(balance)} TOTEM`);
        });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });