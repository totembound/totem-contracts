import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers"; // Adjust the relative path based on your folder structure
import { TotemGame, TotemNFT } from "../typechain-types"; // Adjust based on your typechain output directory
import { species, colors, stages, ipfsHashes } from "./totem-metadata";

// Function to get last day of current month at midnight UTC
function getLastDayOfMonth(): number {
    const now = new Date();
    // Get the first day of next month
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    // Subtract 1 second to get last moment of current month at UTC midnight
    return Math.floor(nextMonth.getTime() / 1000) - 1;
}

function getEndOfWeek(): number {
    const now = new Date();
    
    // Get next Sunday
    const daysUntilSunday = 7 - now.getUTCDay();
    // If today is Sunday and we've passed midnight, we want next Sunday
    const targetDay = daysUntilSunday === 0 && now.getUTCHours() > 0 ? 7 : daysUntilSunday;
    
    // Set to next Sunday at midnight UTC
    const endOfWeek = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + targetDay,
        0, 0, 0, 0
    ));
    
    // Convert to unix timestamp (seconds)
    return Math.floor(endOfWeek.getTime() / 1000) - 1;
}

async function main() {
    const networkName = network.name;
    const deployment = loadDeployment(networkName);
    console.log("Loading contracts...\n");
  
    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as unknown as TotemGame;

    const nft = await ethers.getContractAt(
        "TotemNFT",
        deployment.totemNFTProxy
    ) as unknown as TotemNFT;

    // setup the colors
    await game.setValidColorsForRarities(
        [0, 0, 0, 0,   // Common
         1, 1, 1, 1,   // Uncommon
         2, 2, 2,      // Rare
         3, 3, 3,      // Epic
         4, 4,         // Legendary
         5, 5, 5, 5,   // Limited, 12 colors
         5, 5, 5, 5,
         5, 5, 5, 5],
        [0, 1, 2, 3,     // Common -> Brown, Gray, White, Tawny
         4, 5, 6, 7,     // Uncommon -> Slate, Copper, Cream, Dappled
         8, 9, 10,       // Rare -> Golden, DarkPurple, Charcoal
         11, 12, 13,     // Epic -> EmeraldGreen, CrimsonRed, DeepSapphire
         14, 15,         // Legendary -> EtherealSilver, RadiantGold
         16, 17, 18, 19, // Limited -> FrostbiteBlue, RosyPink, VerdantGold, RaindropTeal,
         20, 21, 22, 23, // FloralViolet, SunsetOrange, EmberRed, OceanicAzure,
         24, 25, 26, 27] // HarvestGold, PhantomBlack, EmberwoodBrown, StarlitSilver
    );

    // Ensure array lengths match
    if (species.length !== colors.length || 
        colors.length !== stages.length || 
        stages.length !== ipfsHashes.length) {
        throw new Error("Array lengths do not match");
    }

    // Call through the game contract
    console.log("Setting metadata URIs through game contract...");
    const tx = await game.setMetadataURIs(species, colors, stages, ipfsHashes);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Metadata URIs have been set successfully!");

    // Look for MetadataURISet events
    console.log("\nChecking emitted events:");
    const metadataEvents = receipt?.logs
        .filter(log => {
            try {
                return nft.interface.parseLog(log)?.name === 'MetadataURISet';
            }
            catch {
                return false;
            }
        })
        .map(log => {
            const parsed = nft.interface.parseLog(log);
            return {
                species: parsed?.args.species,
                color: parsed?.args.color,
                stage: parsed?.args.stage,
                uri: parsed?.args.uri
            };
        });

    if (metadataEvents && metadataEvents.length > 0) {
        console.log(`\nMetadata URIs set: ${metadataEvents.length}`);
        /* metadataEvents?.forEach((event, i) => {
            console.log(`\nCombination ${i}:`);
            console.log(`Species: ${event.species}`);
            console.log(`Color: ${event.color}`);
            console.log(`Stage: ${event.stage}`);
            console.log(`URI: ${event.uri}`);
         });*/
    }
    else {
        console.log("No MetadataURISet events found!");
    }

    // Setup initial bundles
    console.log("\nSetting up initial bundles...");
    const monthEnd = getLastDayOfMonth();
    const endOfWeek = getEndOfWeek();

    // New Player Bundle (10 POL)
    console.log("Creating New Player Bundle...");
    await game.createBundle(
        ethers.parseEther("10"),          // 10 POL
        ethers.parseUnits("1000", 18),    // 1000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        1,                                // Rarity.Uncommon minimum
        1,                                // Rarity.Uncommon maximum
        false,                            // Not limited rarity
        0                                 // No expiry
    );

    // Weekly Rare Bundle (20 POL)
    console.log("Creating Weekly Rare Bundle...");
    await game.createBundle(
        ethers.parseEther("20"),          // 20 POL
        ethers.parseUnits("2000", 18),    // 2000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        2,                                // Rarity.Rare minimum
        2,                                // Rarity.Rare maximum
        false,                            // Not limited rarity
        endOfWeek                         // Expires end of this week, Sunday midnight
    );

    // Weekly Epic Bundle (50 POL)
    console.log("Creating Weekly Epic Bundle...");
    await game.createBundle(
        ethers.parseEther("50"),          // 50 POL
        ethers.parseUnits("5000", 18),    // 5000 TOTEM
        12,                               // Species.None (random)
        28,                               // Color.None (random)
        3,                                // Rarity.Epic minimum
        3,                                // Rarity.Epic maximum
        false,                            // Not limited rarity
        endOfWeek                         // Expires end of this week, Sunday midnight
    );

    // Monthly Special Bundle (250 POL)
    console.log("Creating Monthly Special Bundle...");
    /* await game.createBundle(
        ethers.parseEther("250"),         // 250 POL
        ethers.parseUnits("10000", 18),   // 10000 TOTEM
        1,                                // Species.Otter
        17,                               // Color.RosyPink
        5,                                // Rarity.Limited
        5,                                // Rarity.Limited
        true,                             // Is limited rarity
        monthEnd                          // Expires end of month
    ); */
    /* await game.createBundle(
        ethers.parseEther("250"),         // 250 POL
        ethers.parseUnits("10000", 18),   // 10000 TOTEM
        2,                                // Species.Wolf
        18,                               // Color.VerdantGold
        5,                                // Rarity.Limited
        5,                                // Rarity.Limited
        true,                             // Is limited rarity
        monthEnd                          // Expires end of month
    ); */
    await game.createBundle(
        ethers.parseEther("250"),         // 250 POL
        ethers.parseUnits("10000", 18),   // 10000 TOTEM
        3,                                // Species.Falcon
        19,                               // Color.RaindropTeal
        5,                                // Rarity.Limited
        5,                                // Rarity.Limited
        true,                             // Is limited rarity
        monthEnd                          // Expires end of month
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });