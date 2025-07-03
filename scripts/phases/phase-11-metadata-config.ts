import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";
import { TotemGame, TotemNFT, TotemShop } from "../../typechain-types";
import { species, colors, stages, ipfsHashes } from "../totem-metadata";

// Helper function to split arrays into batches
function splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

export async function configureMetadata(context: DeploymentContext): Promise<void> {
  const { signer, state } = context;
  
  console.log("\n📋 Phase 11: Metadata Configuration");
  console.log("===================================");

  const getAddress = (contractName: string): string => {
    const contract = state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  await withErrorHandling(async () => {
    console.log("Loading contracts...");
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer) as TotemGame;
    const nft = await ethers.getContractAt("TotemNFT", getAddress("nftProxy"), signer) as TotemNFT;
    const shop = await ethers.getContractAt("TotemShop", getAddress("shopProxy"), signer) as TotemShop;

    console.log("Setting up color rarity mappings...");
    
    // Set up color rarity mappings (from deploy-metadata.ts)
    await (await game.setValidColorsForRarities(
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
    )).wait();
    console.log("✅ Color rarity mappings configured");

    console.log("Deploying IPFS metadata URIs...");
    
    // Validate array lengths
    if (species.length !== colors.length || 
        colors.length !== stages.length || 
        stages.length !== ipfsHashes.length) {
      throw new Error("Array lengths do not match");
    }

    // Batch process metadata URIs to avoid gas limits
    const BATCH_SIZE = 85;
    const speciesBatches = splitIntoBatches(species, BATCH_SIZE);
    const colorsBatches = splitIntoBatches(colors, BATCH_SIZE);
    const stagesBatches = splitIntoBatches(stages, BATCH_SIZE);
    const ipfsHashesBatches = splitIntoBatches(ipfsHashes, BATCH_SIZE);

    console.log(`Processing ${ipfsHashes.length} metadata URIs in batches of ${BATCH_SIZE}...`);
    console.log(`Total batches: ${speciesBatches.length}`);

    let totalMetadataSet = 0;

    for (let i = 0; i < speciesBatches.length; i++) {
      console.log(`Processing batch ${i + 1} of ${speciesBatches.length}...`);
      
      const tx = await game.setMetadataURIs(
        speciesBatches[i], 
        colorsBatches[i], 
        stagesBatches[i], 
        ipfsHashesBatches[i]
      );
      
      const receipt = await tx.wait();
      console.log(`✅ Batch ${i + 1} processed successfully`);
      
      // Count MetadataURISet events
      const metadataEvents = receipt?.logs?.filter(log => {
        try {
          return nft.interface.parseLog(log)?.name === 'MetadataURISet';
        } catch {
          return false;
        }
      });
      
      if (metadataEvents && metadataEvents.length > 0) {
        totalMetadataSet += metadataEvents.length;
      }
      
      // Brief pause between batches
      if (i < speciesBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Total metadata URIs set: ${totalMetadataSet}`);

    console.log("Creating shop bundles...");
    
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
    const monthEnd = getLastDayOfMonth();
    const endOfWeek = getEndOfWeek();
    
    // Create shop bundles (EXACT original data from deploy-metadata.ts)
    const bundles = [
      {
        price: ethers.parseEther("10"),          // 10 POL
        tokens: ethers.parseUnits("1000", 18),   // 1000 TOTEM
        species: 12,                             // Species.None (random)
        color: 28,                               // Color.None (random)
        minRarity: 1,                            // Rarity.Uncommon minimum
        maxRarity: 1,                            // Rarity.Uncommon maximum
        isLimited: false,                        // Not limited rarity
        expiry: 0,                               // No expiry
        name: "New Player Bundle"
      },
      {
        price: ethers.parseEther("20"),          // 20 POL
        tokens: ethers.parseUnits("2000", 18),   // 2000 TOTEM
        species: 12,                             // Species.None (random)
        color: 28,                               // Color.None (random)
        minRarity: 2,                            // Rarity.Rare minimum
        maxRarity: 2,                            // Rarity.Rare maximum
        isLimited: false,                        // Not limited rarity
        expiry: endOfWeek,                       // Expires end of this week, Sunday midnight
        name: "Weekly Rare Bundle"
      },
      {
        price: ethers.parseEther("50"),          // 50 POL
        tokens: ethers.parseUnits("5000", 18),   // 5000 TOTEM
        species: 12,                             // Species.None (random)
        color: 28,                               // Color.None (random)
        minRarity: 3,                            // Rarity.Epic minimum
        maxRarity: 3,                            // Rarity.Epic maximum
        isLimited: false,                        // Not limited rarity
        expiry: endOfWeek,                       // Expires end of this week, Sunday midnight
        name: "Weekly Epic Bundle"
      },
      {
        price: ethers.parseEther("250"),         // 250 POL
        tokens: ethers.parseUnits("10000", 18),  // 10000 TOTEM
        species: 6,                              // Species.Woodpecker
        color: 22,                               // Color.EmberRed
        minRarity: 5,                            // Rarity.Limited
        maxRarity: 5,                            // Rarity.Limited
        isLimited: true,                         // Is limited rarity
        expiry: monthEnd,                        // Expires end of month
        name: "Monthly Special Bundle (Woodpecker)"
      }
    ];

    for (const bundle of bundles) {
      const tx = await shop.createBundle(
        bundle.price,
        bundle.tokens,
        bundle.species,
        bundle.color,
        bundle.minRarity,
        bundle.maxRarity,
        bundle.isLimited,
        bundle.expiry
      );
      await tx.wait();
      console.log(`✅ Created ${bundle.name}`);
    }

  }, context, context.errorHandler);

  state.phase = DeploymentPhase.VERIFICATION;
  console.log("\n✅ Phase 11 Complete: Full metadata system configured");
  console.log("   - Color rarity mappings: ✅");
  console.log("   - IPFS metadata URIs: ✅");
  console.log("   - Available species: ✅");
  console.log("   - Shop bundles (4): New Player, Weekly Rare, Weekly Epic, Monthly Special: ✅");
}

export function getMetadataConfigSteps(): DeploymentStep[] {
  return [
    { 
      id: "color-rarity-mappings", 
      name: "Configure Color Rarity Mappings", 
      phase: DeploymentPhase.METADATA_CONFIG,
      dependencies: ["gameProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "ipfs-metadata-uris", 
      name: "Deploy IPFS Metadata URIs", 
      phase: DeploymentPhase.METADATA_CONFIG,
      dependencies: ["gameProxy", "nftProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "shop-bundles", 
      name: "Create Shop Bundles (4): New Player, Weekly Rare, Weekly Epic, Monthly Special", 
      phase: DeploymentPhase.METADATA_CONFIG,
      dependencies: ["shopProxy"],
      optional: false,
      retryable: true
    }
  ];
}