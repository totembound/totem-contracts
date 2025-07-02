import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function setupGameLogic(context: DeploymentContext): Promise<void> {
  const { signer } = context;
  
  console.log("\n🎮 Phase 6: Game Logic Setup");
  console.log("===========================");

  const getAddress = (contractName: string) => {
    const contract = context.state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  await withErrorHandling(async () => {
    console.log("Setting initial available species...");
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);
    
    const initialSpecies = [0, 1, 2, 3, 4, 11]; // Goose, Otter, Wolf, Falcon, Beaver, Owl
    await (await game.updateAvailableSpecies(initialSpecies)).wait();
    
    console.log("✅ Initial species set:", initialSpecies.map(s => `#${s}`).join(', '));
  }, context, context.errorHandler);

  await withErrorHandling(async () => {
    console.log("Configuring action configs...");
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);
    
    // Feed action config
    const feedConfig = {
      cost: ethers.parseUnits("10", 18),
      cooldown: 0,
      maxDaily: 3,
      minHappiness: 0,
      happinessChange: 10,
      experienceGain: 0,
      useTimeWindows: true,
      increasesHappiness: true,
      enabled: true
    };
    await (await game.updateActionConfig(0, feedConfig)).wait(); // ActionType.Feed = 0
    console.log("✅ Feed action configured");

    // Train action config  
    const trainConfig = {
      cost: ethers.parseUnits("20", 18),
      cooldown: 0,
      maxDaily: 0,
      minHappiness: 20,
      happinessChange: 10,
      experienceGain: 1000,
      useTimeWindows: false,
      increasesHappiness: false,
      enabled: true
    };
    await (await game.updateActionConfig(1, trainConfig)).wait(); // ActionType.Train = 1
    console.log("✅ Train action configured");

    // Treat action config
    const treatConfig = {
      cost: ethers.parseUnits("20", 18),
      cooldown: 14400, // 4 hours
      maxDaily: 0,
      minHappiness: 0,
      happinessChange: 10,
      experienceGain: 0,
      useTimeWindows: false,
      increasesHappiness: true,
      enabled: true
    };
    await (await game.updateActionConfig(2, treatConfig)).wait(); // ActionType.Treat = 2
    console.log("✅ Treat action configured");
    
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.VERIFICATION;
  console.log("\n✅ Phase 6 Complete: Game logic setup finished");
}

export function getGameLogicSteps(): DeploymentStep[] {
  return [
    { 
      id: "species-config", 
      name: "Set Initial Species", 
      phase: DeploymentPhase.GAME_LOGIC_SETUP,
      dependencies: ["gameProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "action-configs", 
      name: "Configure Game Actions", 
      phase: DeploymentPhase.GAME_LOGIC_SETUP,
      dependencies: ["gameProxy"],
      optional: false,
      retryable: true
    }
  ];
}