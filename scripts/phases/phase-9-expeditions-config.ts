import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";
import { TotemExpeditions } from "../../typechain-types";

export async function configureExpeditions(context: DeploymentContext): Promise<void> {
  const { signer, state } = context;
  
  console.log("\n🗺️  Phase 9: Expeditions Configuration");
  console.log("====================================");

  const getAddress = (contractName: string): string => {
    const contract = state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  await withErrorHandling(async () => {
    console.log("Loading Expeditions contract (already deployed as proxy)...");
    
    // Get contract instance with proper typing
    const expeditionsContract = await ethers.getContractAt("TotemExpeditions", getAddress("expeditionsProxy"), signer) as TotemExpeditions;

    console.log("Configuring expeditions...");

    // Helper function to convert hours to seconds
    const hoursToSeconds = (hours: number) => hours * 60 * 60;
    
    // Configuration for 3-hour expeditions (from original deploy-expeditions.ts)
    const threeHourExpeditions = [
        {
            id: "wind-scout-patrol",
            name: "Wind Scout Patrol",
            domain: 0, // Air
            duration: hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 0, 0], // 100% Lesser, 0% Greater, 0% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "harvesting-run",
            name: "Harvesting Run",
            domain: 1, // Earth
            duration: hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 0, 0], // 100% Lesser, 0% Greater, 0% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "quick-study-ritual",
            name: "Quick Study Ritual",
            domain: 2, // Water
            duration: hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 0, 0], // 100% Lesser, 0% Greater, 0% Ancient
            minStage: 1 // Stage 2
        }
    ];
    
    // Configuration for 6-hour expeditions
    const sixHourExpeditions = [
        {
            id: "diplomatic-envoy",
            name: "Diplomatic Envoy",
            domain: 0, // Air
            duration: hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 25, 0], // 100% Lesser, 25% Greater, 0% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "ruins-recovery",
            name: "Ruins Recovery",
            domain: 1, // Earth
            duration: hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 25, 0], // 100% Lesser, 25% Greater, 0% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "basic-research-mission",
            name: "Basic Research Mission",
            domain: 2, // Water
            duration: hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 25, 0], // 100% Lesser, 25% Greater, 0% Ancient
            minStage: 1 // Stage 2
        }
    ];
    
    // Configuration for 12-hour expeditions
    const twelveHourExpeditions = [
        {
            id: "festival-envoy",
            name: "Festival Envoy",
            domain: 0, // Air
            duration: hoursToSeconds(12),
            totemCost: ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 50, 10], // 100% Lesser, 50% Greater, 10% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "warden-patrol",
            name: "Warden Patrol",
            domain: 1, // Earth
            duration: hoursToSeconds(12),
            totemCost: 120, // ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 50, 10], // 100% Lesser, 50% Greater, 10% Ancient
            minStage: 1 // Stage 2
        },
        {
            id: "sigil-synthesis",
            name: "Sigil Synthesis",
            domain: 2, // Water
            duration: hoursToSeconds(12),
            totemCost: ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 50, 10], // 100% Lesser, 50% Greater, 10% Ancient
            minStage: 1 // Stage 2
        }
    ];
    
    // Configuration for 24-hour expeditions
    const twentyFourHourExpeditions = [
        {
            id: "celestial-mapping",
            name: "Celestial Mapping",
            domain: 0, // Air
            duration: hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 75, 25], // 100% Lesser, 75% Greater, 25% Ancient
            minStage: 2 // Stage 3
        },
        {
            id: "deep-exploration",
            name: "Deep Exploration",
            domain: 1, // Earth
            duration: hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 75, 25], // 100% Lesser, 75% Greater, 25% Ancient
            minStage: 2 // Stage 3
        },
        {
            id: "spirit-diplomacy",
            name: "Spirit Diplomacy",
            domain: 2, // Water
            duration: hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 75, 25], // 100% Lesser, 75% Greater, 25% Ancient
            minStage: 2 // Stage 3
        }
    ];
    
    // Deploy all expeditions (from original deploy-expeditions.ts)
    const allExpeditions = [
      ...threeHourExpeditions,
      ...sixHourExpeditions,
      ...twelveHourExpeditions,
      ...twentyFourHourExpeditions
    ];
    
    for (const config of allExpeditions) {
      console.log(`Configuring ${config.name}...`);
      const tx = await expeditionsContract.configureExpedition(
        config.id,
        config.name,
        config.domain,
        config.duration,
        config.totemCost,
        config.happinessCost,
        config.baseExp,
        config.affinityWeights as [number, number, number],
        config.runeDropChances as [number, number, number],
        config.minStage
      );
      await tx.wait();
      console.log(`✅ ${config.name} configured!`);
    }

    // Authorize expeditions in game contract
    console.log("Authorizing expeditions in game...");
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);
    await (await game.authorize(getAddress("expeditionsProxy"))).wait();
    console.log("✅ Expeditions authorized in game");

  }, context, context.errorHandler);

  state.phase = DeploymentPhase.REWARDS_CONFIG;
  console.log("\n✅ Phase 9 Complete: Expeditions configured");
}

export function getExpeditionsConfigSteps(): DeploymentStep[] {
  return [
    { 
      id: "three-hour-expeditions", 
      name: "Configure 3-Hour Expeditions (3)", 
      phase: DeploymentPhase.EXPEDITIONS_CONFIG,
      dependencies: ["expeditionsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "six-hour-expeditions", 
      name: "Configure 6-Hour Expeditions (3)", 
      phase: DeploymentPhase.EXPEDITIONS_CONFIG,
      dependencies: ["expeditionsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "twelve-hour-expeditions", 
      name: "Configure 12-Hour Expeditions (3)", 
      phase: DeploymentPhase.EXPEDITIONS_CONFIG,
      dependencies: ["expeditionsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "twentyfour-hour-expeditions", 
      name: "Configure 24-Hour Expeditions (3)", 
      phase: DeploymentPhase.EXPEDITIONS_CONFIG,
      dependencies: ["expeditionsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "authorize-expeditions", 
      name: "Authorize Expeditions in Game", 
      phase: DeploymentPhase.EXPEDITIONS_CONFIG,
      dependencies: ["expeditionsProxy", "gameProxy"],
      optional: false,
      retryable: true
    }
  ];
}