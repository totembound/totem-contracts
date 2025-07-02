import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function configureTokenAllocations(context: DeploymentContext): Promise<void> {
  const { signer } = context;
  
  console.log("\n💰 Phase 5: Token Allocations");
  console.log("=============================");

  const getAddress = (contractName: string) => {
    const contract = context.state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  enum AllocationCategory {
    Game,
    Rewards,
    Ecosystem,
    Liquidity,
    Marketing,
    Team,
    Reserved
  }

  await withErrorHandling(async () => {
    console.log("Allocating tokens to Game contract...");
    const token = await ethers.getContractAt("TotemToken", getAddress("tokenProxy"), signer);
    
    const gameAllocation = ethers.parseUnits("250000000", 18); // 250M TOTEM
    const tx = await token.transferAllocation(
      AllocationCategory.Game,
      getAddress("gameProxy"),
      gameAllocation
    );
    await tx.wait();
    
    console.log("✅ Game allocated with 250M TOTEM tokens");
  }, context, context.errorHandler);

  await withErrorHandling(async () => {
    console.log("Allocating tokens to Rewards contract...");
    const token = await ethers.getContractAt("TotemToken", getAddress("tokenProxy"), signer);
    
    const rewardsAllocation = ethers.parseUnits("150000000", 18); // 150M TOTEM
    const tx = await token.transferAllocation(
      AllocationCategory.Rewards,
      getAddress("rewardsProxy"),
      rewardsAllocation
    );
    await tx.wait();
    
    console.log("✅ Rewards allocated with 150M TOTEM tokens");
  }, context, context.errorHandler);

  await withErrorHandling(async () => {
    console.log("Setting up contract relationships...");
    
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);
    
    // Authorize shop in game
    await (await game.authorize(getAddress("shopProxy"))).wait();
    console.log("✅ Shop authorized in Game");
    
    // Set challenges in game
    await (await game.setChallenges(getAddress("challengesProxy"))).wait();
    console.log("✅ Challenges set in Game");
    
    // Transfer NFT ownership to game (required for metadata management)
    const nft = await ethers.getContractAt("TotemNFT", getAddress("nftProxy"), signer);
    await (await nft.transferOwnership(getAddress("gameProxy"))).wait();
    console.log("✅ NFT ownership transferred to Game");
    
    // Transfer challenges ownership to game (required for configuration)
    const challenges = await ethers.getContractAt("TotemChallenges", getAddress("challengesProxy"), signer);
    await (await challenges.transferOwnership(getAddress("gameProxy"))).wait();
    console.log("✅ Challenges ownership transferred to Game");
    
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.GAME_LOGIC_SETUP;
  console.log("\n✅ Phase 5 Complete: Token allocations and ownership transfers done");
}

export function getTokenAllocationSteps(): DeploymentStep[] {
  return [
    { 
      id: "game-allocation", 
      name: "Allocate Tokens to Game", 
      phase: DeploymentPhase.TOKEN_ALLOCATIONS,
      dependencies: ["tokenProxy", "gameProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "rewards-allocation", 
      name: "Allocate Tokens to Rewards", 
      phase: DeploymentPhase.TOKEN_ALLOCATIONS,
      dependencies: ["tokenProxy", "rewardsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "ownership-transfers", 
      name: "Transfer Contract Ownerships", 
      phase: DeploymentPhase.TOKEN_ALLOCATIONS,
      dependencies: ["nftProxy", "challengesProxy", "gameProxy", "shopProxy"],
      optional: false,
      retryable: true
    }
  ];
}