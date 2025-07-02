import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function deployCoreImplementations(context: DeploymentContext): Promise<void> {
  const { signer, provider } = context;
  
  console.log("\n⚙️  Phase 2: Core Implementations Deployment");
  console.log("============================================");

  // Deploy Token Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Token Implementation...");
    const TotemToken = await ethers.getContractFactory("TotemToken", signer);
    const tokenImplementation = await TotemToken.deploy();
    await tokenImplementation.waitForDeployment();
    
    const tokenImplementationAddress = await tokenImplementation.getAddress();
    context.state.deployedContracts["tokenImplementation"] = {
      address: tokenImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: tokenImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Token Implementation deployed:", tokenImplementationAddress);
  }, context, context.errorHandler);

  // Deploy NFT Implementation
  await withErrorHandling(async () => {
    console.log("Deploying NFT Implementation...");
    const TotemNFT = await ethers.getContractFactory("TotemNFT", signer);
    const nftImplementation = await TotemNFT.deploy();
    await nftImplementation.waitForDeployment();
    
    const nftImplementationAddress = await nftImplementation.getAddress();
    context.state.deployedContracts["nftImplementation"] = {
      address: nftImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: nftImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ NFT Implementation deployed:", nftImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Game Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Game Implementation...");
    const TotemGame = await ethers.getContractFactory("TotemGame", signer);
    const gameImplementation = await TotemGame.deploy();
    await gameImplementation.waitForDeployment();
    
    const gameImplementationAddress = await gameImplementation.getAddress();
    context.state.deployedContracts["gameImplementation"] = {
      address: gameImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: gameImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Game Implementation deployed:", gameImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Shop Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Shop Implementation...");
    const TotemShop = await ethers.getContractFactory("TotemShop", signer);
    const shopImplementation = await TotemShop.deploy();
    await shopImplementation.waitForDeployment();
    
    const shopImplementationAddress = await shopImplementation.getAddress();
    context.state.deployedContracts["shopImplementation"] = {
      address: shopImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: shopImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Shop Implementation deployed:", shopImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Rewards Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Rewards Implementation...");
    const TotemRewards = await ethers.getContractFactory("TotemRewards", signer);
    const rewardsImplementation = await TotemRewards.deploy();
    await rewardsImplementation.waitForDeployment();
    
    const rewardsImplementationAddress = await rewardsImplementation.getAddress();
    context.state.deployedContracts["rewardsImplementation"] = {
      address: rewardsImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: rewardsImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Rewards Implementation deployed:", rewardsImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Achievements Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Achievements Implementation...");
    const TotemAchievements = await ethers.getContractFactory("TotemAchievements", signer);
    const achievementsImplementation = await TotemAchievements.deploy();
    await achievementsImplementation.waitForDeployment();
    
    const achievementsImplementationAddress = await achievementsImplementation.getAddress();
    context.state.deployedContracts["achievementsImplementation"] = {
      address: achievementsImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: achievementsImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Achievements Implementation deployed:", achievementsImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Challenges Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Challenges Implementation...");
    const TotemChallenges = await ethers.getContractFactory("TotemChallenges", signer);
    const challengesImplementation = await TotemChallenges.deploy();
    await challengesImplementation.waitForDeployment();
    
    const challengesImplementationAddress = await challengesImplementation.getAddress();
    context.state.deployedContracts["challengesImplementation"] = {
      address: challengesImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: challengesImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Challenges Implementation deployed:", challengesImplementationAddress);
  }, context, context.errorHandler);

  // Deploy Expeditions Implementation
  await withErrorHandling(async () => {
    console.log("Deploying Expeditions Implementation...");
    const TotemExpeditions = await ethers.getContractFactory("TotemExpeditions", signer);
    const expeditionsImplementation = await TotemExpeditions.deploy();
    await expeditionsImplementation.waitForDeployment();
    
    const expeditionsImplementationAddress = await expeditionsImplementation.getAddress();
    context.state.deployedContracts["expeditionsImplementation"] = {
      address: expeditionsImplementationAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: expeditionsImplementation.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Expeditions Implementation deployed:", expeditionsImplementationAddress);
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.PROXY_DEPLOYMENTS;
  console.log("\n✅ Phase 2 Complete: Core implementations deployed");
}

export function getCoreImplementationSteps(): DeploymentStep[] {
  return [
    { 
      id: "token-implementation", 
      name: "Deploy Token Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "nft-implementation", 
      name: "Deploy NFT Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "game-implementation", 
      name: "Deploy Game Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "shop-implementation", 
      name: "Deploy Shop Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "rewards-implementation", 
      name: "Deploy Rewards Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "achievements-implementation", 
      name: "Deploy Achievements Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "challenges-implementation", 
      name: "Deploy Challenges Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "expeditions-implementation", 
      name: "Deploy Expeditions Implementation", 
      phase: DeploymentPhase.CORE_IMPLEMENTATIONS,
      dependencies: [], 
      optional: false, 
      retryable: true 
    }
  ];
}