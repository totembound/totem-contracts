import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemGame, TotemNFT, TotemToken, TotemShop } from "../typechain-types";

// Define enums to match the contract
enum Species {
    Goose,
    Otter,
    Wolf,
    Falcon,
    Beaver,
    Deer,
    Woodpecker,
    Turtle,
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
    Slate,
    Copper,
    Cream,
    Dappled,
    Golden,
    DarkPurple,
    Charcoal,
    EmeraldGreen,
    CrimsonRed,
    DeepSapphire,
    EtherealSilver,
    RadiantGold,
    FrostbiteBlue,
    RosyPink,
    VerdantGold,
    RaindropTeal,
    FloralViolet,
    SunsetOrange,
    EmberRed,
    OceanicAzure,
    HarvestGold,
    PhantomBlack,
    EmberwoodBrown,
    StarlitSilver,
    None
}

enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
    Limited
}

async function main() {
    const networkName = network.name;
    const deployment = loadDeployment(networkName);
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
        deployment.totemNFTProxy
    ) as unknown as TotemNFT;

    const token = await ethers.getContractAt(
        "TotemToken",
        deployment.tokenProxy  // Updated to use tokenProxy
    ) as unknown as TotemToken;

    const shop = await ethers.getContractAt(
        "TotemShop",
        deployment.shopProxy
    ) as unknown as TotemShop;

    // Get proxy admin info
    const proxyAdmin = await ethers.getContractAt("TotemProxyAdmin", deployment.proxyAdmin);
    console.log("=== Proxy Information ===");
    console.log(`Token Implementation: ${deployment.tokenImplementation}`);
    console.log(`Game Implementation: ${deployment.gameImplementation}`);
    console.log(`Shop Implementation: ${deployment.shopImplementation}`);
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
    const rarityCount = new Array(6).fill(0);
    const colorCount = new Array(29).fill(0); 
    const stageCount = new Array(5).fill(0);

    // Existing NFT iteration with added metrics...
    for (let i = 1; i <= totalSupply; i++) {
        const tokenId = i;
        try {
            const attrs = await nft.attributes(tokenId);
            speciesCount[Number(attrs.species)]++;
            rarityCount[Number(attrs.rarity)]++;
            colorCount[Number(attrs.color)]++;
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

    console.log("\nColor Distribution:");
    colorCount.forEach((count, index) => {
        if (index < 28) {  // Don't show None
            const percentage = totalSupply > 0 
                ? ((BigInt(count) * BigInt(100) * BigInt(100) / totalSupply) * BigInt(1)) / BigInt(100)
                : BigInt(0);
            console.log(`${Color[index]}: ${count} (${percentage.toString()}%)`);
        }
    });

    console.log("\nColors by Rarity:");
    for (let r = 0; r < 6; r++) {  // For each rarity
        if (rarityCount[r] > 0) {  // Only show rarities that exist
            console.log(`\n${Rarity[r]}:`);
            const colorsByRarity = new Array(29).fill(0);
            
            // Count colors for this rarity
            for (let i = 1; i <= totalSupply; i++) {
                const attrs = await nft.attributes(i);
                if (Number(attrs.rarity) === r) {
                    colorsByRarity[Number(attrs.color)]++;
                }
            }
            
            // Print colors for this rarity
            colorsByRarity.forEach((count, index) => {
                if (count > 0 && index < 29) {  // Only show colors that exist
                    const percentage = (Number(count) * 100 / Number(rarityCount[r])).toFixed(2);
                    console.log(`  ${Color[index]}: ${count} (${percentage}%)`);
                }
            });
        }
    }

    console.log("\nStage Distribution:");
    stageCount.forEach((count, index) => {
        console.log(`Stage ${index}: ${count}`);
    });

    console.log("\n=== Shop Configuration ===");
    console.log(`Shop Address: ${deployment.shopProxy}`);
    console.log(`Game's Authorized Shop: ${await game.authorizedShop()}`);
    console.log(`Shop's Game Address: ${await shop.game()}`);
    console.log(`Shop Trusted Forwarder: ${await shop.trustedForwarder()}`);
    
    // Get bundle information if available
    try {
        const bundleCount = await shop.nextBundleId();
        console.log(`\nActive Bundles: ${bundleCount}`);
        
        for (let i = 0; i < Number(bundleCount); i++) {
            const bundle = await shop.bundles(i);
            console.log(`\nBundle #${i}:`);
            console.log(`  POL Cost: ${ethers.formatEther(bundle.polCost)} POL`);
            console.log(`  Token Amount: ${ethers.formatEther(bundle.tokenAmount)} TOTEM`);
            console.log(`  Species: ${Species[Number(bundle.species)]}`);
            console.log(`  Min Rarity: ${Rarity[Number(bundle.minRarity)]}`);
            console.log(`  Max Rarity: ${Rarity[Number(bundle.maxRarity)]}`);
            console.log(`  Enabled: ${bundle.enabled}`);
            console.log(`  Limited Rarity: ${bundle.isLimitedRarity}`);
            
            const validUntil = bundle.validUntil;
            if (validUntil.toString() === "0") {
                console.log(`  Valid Until: No expiration`);
            } else {
                const expiryDate = new Date(Number(validUntil) * 1000);
                console.log(`  Valid Until: ${expiryDate.toLocaleString()}`);
            }
        }
    }
    catch (error) {
        console.log(`Error fetching bundle information: ${error}`);
    }
    
    // Get marketplace information
    try {
        const unboundCount = await shop.getUnboundTotemCount();
        console.log(`\nUnbound Totems in Marketplace: ${unboundCount}`);
        
        if (unboundCount > 0) {
            const ids = await shop.getUnboundTokenIds(0, Number(unboundCount));
            console.log(`  Token IDs: ${ids.join(', ')}`);
            
            if (unboundCount <= 5) { // Only show details for a reasonable number
                console.log("\nMarketplace Listings:");
                const totems = await shop.getUnboundTotems(0, Number(unboundCount));
                
                for (let i = 0; i < totems.length; i++) {
                    const totem = totems[i];
                    console.log(`\nTotem #${totem.tokenId}:`);
                    console.log(`  Previous Owner: ${totem.previousOwner}`);
                    console.log(`  Sell Price: ${ethers.formatEther(totem.sellPrice)} TOTEM`);
                    console.log(`  Species: ${Species[Number(totem.species)]}`);
                    console.log(`  Color: ${Color[Number(totem.color)]}`);
                    console.log(`  Rarity: ${Rarity[Number(totem.rarity)]}`);
                    console.log(`  Stage: ${totem.stage}`);
                    console.log(`  Happiness: ${totem.happiness}`);
                    console.log(`  Experience: ${totem.experience}`);
                }
            }
        }
    }
    catch (error) {
        console.log(`Error fetching marketplace information: ${error}`);
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
    const validAddresses = uniqueAddresses.filter(addr => addr !== undefined && addr !== null);

    console.log("\n=== Top TOTEM Holders ===");
    const balances = await Promise.all(
        validAddresses.map(async addr => ({
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
