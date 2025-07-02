import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function configureAuthorizations(context: DeploymentContext): Promise<void> {
  const { signer } = context;
  
  console.log("\n🔐 Phase 4: Authorization & Configuration");
  console.log("========================================");

  const getAddress = (contractName: string) => {
    const contract = context.state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  // Setup Achievements authorizations
  await withErrorHandling(async () => {
    console.log("Setting up Achievements authorizations...");
    const achievements = await ethers.getContractAt("TotemAchievements", getAddress("achievementsProxy"), signer);
    
    // Batch authorize NFT, Game, and Rewards
    const contracts = [
      getAddress("nftProxy"), 
      getAddress("gameProxy"), 
      getAddress("rewardsProxy"), 
      getAddress("challengesProxy"), 
      getAddress("expeditionsProxy")];
    
    for (const contractAddr of contracts) {
      const tx = await achievements.authorize(contractAddr);
      await tx.wait();
    }
    
    console.log("✅ Achievements authorizations completed");
  }, context, context.errorHandler);

  // Setup contract cross-references
  await withErrorHandling(async () => {
    console.log("Setting up contract cross-references...");
    
    // Set achievements in contracts
    const nft = await ethers.getContractAt("TotemNFT", getAddress("nftProxy"), signer);
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);
    const rewards = await ethers.getContractAt("TotemRewards", getAddress("rewardsProxy"), signer);
    const challenges = await ethers.getContractAt("TotemChallenges", getAddress("challengesProxy"), signer);
    const expeditions = await ethers.getContractAt("TotemExpeditions", getAddress("expeditionsProxy"), signer);
    
    await (await nft.setAchievements(getAddress("achievementsProxy"))).wait();
    await (await game.setAchievements(getAddress("achievementsProxy"))).wait();
    await (await rewards.setAchievements(getAddress("achievementsProxy"))).wait();
    await (await challenges.setAchievements(getAddress("achievementsProxy"))).wait();
    await (await expeditions.setAchievements(getAddress("achievementsProxy"))).wait();

    // Authorize rewards in game
    await (await game.authorize(getAddress("rewardsProxy"))).wait();
    
    // Set random oracle in NFT
    await (await nft.setRandomOracle(getAddress("randomOracle"))).wait();
    
    console.log("✅ Contract cross-references configured");
  }, context, context.errorHandler);

  // Configure Trusted Forwarder
  await withErrorHandling(async () => {
    console.log("Configuring Trusted Forwarder...");
    const forwarder = await ethers.getContractAt("TotemTrustedForwarder", getAddress("trustedForwarder"), signer);
    
    const proxyAddresses = [
      getAddress("gameProxy"),
      getAddress("nftProxy"),
      getAddress("tokenProxy"),
      getAddress("shopProxy"),
      getAddress("rewardsProxy")
    ];
    
    await (await forwarder.batchSetContractStatus(proxyAddresses, [true, true, true, true, true])).wait();
    
    console.log("✅ Trusted Forwarder configured");
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.TOKEN_ALLOCATIONS;
  console.log("\n✅ Phase 4 Complete: Authorization & Configuration done");
}

export function getAuthorizationSteps(): DeploymentStep[] {
  return [
    { 
      id: "achievements-auth", 
      name: "Setup Achievements Authorizations", 
      phase: DeploymentPhase.AUTHORIZATION_CONFIG,
      dependencies: ["achievementsProxy", "nftProxy", "gameProxy", "rewardsProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "cross-references", 
      name: "Setup Contract Cross-References", 
      phase: DeploymentPhase.AUTHORIZATION_CONFIG,
      dependencies: ["achievementsProxy", "randomOracle"],
      optional: false,
      retryable: true
    },
    { 
      id: "forwarder-config", 
      name: "Configure Trusted Forwarder", 
      phase: DeploymentPhase.AUTHORIZATION_CONFIG,
      dependencies: ["trustedForwarder", "gameProxy", "nftProxy", "tokenProxy", "shopProxy", "rewardsProxy"],
      optional: false,
      retryable: true
    }
  ];
}