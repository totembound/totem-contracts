import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function deployProxies(context: DeploymentContext): Promise<void> {
  const { signer, provider } = context;
  
  console.log("\n🔗 Phase 3: Proxy Deployments");
  console.log("=============================");

  // Helper function to get required addresses
  const getAddress = (contractName: string) => {
    const contract = context.state.deployedContracts[contractName];
    if (!contract) {
      throw new Error(`Required contract ${contractName} not found in deployment state`);
    }
    return contract.address;
  };

  // Deploy Token Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Token Proxy...");
    
    const TotemToken = await ethers.getContractFactory("TotemToken", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initTokenData = TotemToken.interface.encodeFunctionData("initialize", [
      getAddress("priceOracle"),
      getAddress("trustedForwarder")
    ]);

    const tokenProxy = await TotemProxy.deploy(
      getAddress("tokenImplementation"),
      getAddress("proxyAdmin"),
      initTokenData
    );
    await tokenProxy.waitForDeployment();
    
    const tokenProxyAddress = await tokenProxy.getAddress();
    context.state.deployedContracts["tokenProxy"] = {
      address: tokenProxyAddress,
      implementation: getAddress("tokenImplementation"),
      proxy: tokenProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: tokenProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Token Proxy deployed:", tokenProxyAddress);
  }, context, context.errorHandler);

  // Deploy NFT Proxy
  await withErrorHandling(async () => {
    console.log("Deploying NFT Proxy...");
    
    const TotemNFT = await ethers.getContractFactory("TotemNFT", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initNFTData = TotemNFT.interface.encodeFunctionData("initialize", [
      getAddress("trustedForwarder")
    ]);

    const nftProxy = await TotemProxy.deploy(
      getAddress("nftImplementation"),
      getAddress("proxyAdmin"),
      initNFTData
    );
    await nftProxy.waitForDeployment();
    
    const nftProxyAddress = await nftProxy.getAddress();
    context.state.deployedContracts["nftProxy"] = {
      address: nftProxyAddress,
      implementation: getAddress("nftImplementation"),
      proxy: nftProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: nftProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ NFT Proxy deployed:", nftProxyAddress);
  }, context, context.errorHandler);

  // Deploy Game Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Game Proxy...");
    
    const TotemGame = await ethers.getContractFactory("TotemGame", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initialGameParams = {
      signupReward: ethers.parseUnits("2000", 18),
      mintPrice: ethers.parseUnits("500", 18)
    };
    
    const initialTimeWindows = {
      window1Start: 0,      // 00:00 UTC
      window2Start: 28800,  // 08:00 UTC
      window3Start: 57600   // 16:00 UTC
    };   
    
    const initGameData = TotemGame.interface.encodeFunctionData("initialize", [
      getAddress("tokenProxy"),
      getAddress("nftProxy"),
      getAddress("trustedForwarder"),
      initialGameParams,
      initialTimeWindows
    ]);

    const gameProxy = await TotemProxy.deploy(
      getAddress("gameImplementation"),
      getAddress("proxyAdmin"),
      initGameData
    );
    await gameProxy.waitForDeployment();
    
    const gameProxyAddress = await gameProxy.getAddress();
    context.state.deployedContracts["gameProxy"] = {
      address: gameProxyAddress,
      implementation: getAddress("gameImplementation"),
      proxy: gameProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: gameProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Game Proxy deployed:", gameProxyAddress);
  }, context, context.errorHandler);

  // Deploy Shop Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Shop Proxy...");
    
    const TotemShop = await ethers.getContractFactory("TotemShop", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initShopData = TotemShop.interface.encodeFunctionData("initialize", [
      getAddress("gameProxy"),
      getAddress("tokenProxy"),
      getAddress("nftProxy"),
      getAddress("trustedForwarder")
    ]);

    const shopProxy = await TotemProxy.deploy(
      getAddress("shopImplementation"),
      getAddress("proxyAdmin"),
      initShopData
    );
    await shopProxy.waitForDeployment();
    
    const shopProxyAddress = await shopProxy.getAddress();
    context.state.deployedContracts["shopProxy"] = {
      address: shopProxyAddress,
      implementation: getAddress("shopImplementation"),
      proxy: shopProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: shopProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Shop Proxy deployed:", shopProxyAddress);
  }, context, context.errorHandler);

  // Deploy Rewards Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Rewards Proxy...");
    
    const TotemRewards = await ethers.getContractFactory("TotemRewards", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initRewardsData = TotemRewards.interface.encodeFunctionData("initialize", [
      getAddress("gameProxy"),
      getAddress("tokenProxy"),
      getAddress("nftProxy"),
      getAddress("trustedForwarder")
    ]);

    const rewardsProxy = await TotemProxy.deploy(
      getAddress("rewardsImplementation"),
      getAddress("proxyAdmin"),
      initRewardsData
    );
    await rewardsProxy.waitForDeployment();
    
    const rewardsProxyAddress = await rewardsProxy.getAddress();
    context.state.deployedContracts["rewardsProxy"] = {
      address: rewardsProxyAddress,
      implementation: getAddress("rewardsImplementation"),
      proxy: rewardsProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: rewardsProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Rewards Proxy deployed:", rewardsProxyAddress);
  }, context, context.errorHandler);

  // Deploy Achievements Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Achievements Proxy...");
    
    const TotemAchievements = await ethers.getContractFactory("TotemAchievements", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initAchievementsData = TotemAchievements.interface.encodeFunctionData("initialize", []);

    const achievementsProxy = await TotemProxy.deploy(
      getAddress("achievementsImplementation"),
      getAddress("proxyAdmin"),
      initAchievementsData
    );
    await achievementsProxy.waitForDeployment();
    
    const achievementsProxyAddress = await achievementsProxy.getAddress();
    context.state.deployedContracts["achievementsProxy"] = {
      address: achievementsProxyAddress,
      implementation: getAddress("achievementsImplementation"),
      proxy: achievementsProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: achievementsProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Achievements Proxy deployed:", achievementsProxyAddress);
  }, context, context.errorHandler);

  // Deploy Challenges Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Challenges Proxy...");
    
    const TotemChallenges = await ethers.getContractFactory("TotemChallenges", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initChallengesData = TotemChallenges.interface.encodeFunctionData("initialize", []);

    const challengesProxy = await TotemProxy.deploy(
      getAddress("challengesImplementation"),
      getAddress("proxyAdmin"),
      initChallengesData
    );
    await challengesProxy.waitForDeployment();
    
    const challengesProxyAddress = await challengesProxy.getAddress();
    context.state.deployedContracts["challengesProxy"] = {
      address: challengesProxyAddress,
      implementation: getAddress("challengesImplementation"),
      proxy: challengesProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: challengesProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Challenges Proxy deployed:", challengesProxyAddress);
  }, context, context.errorHandler);

  // Deploy Expeditions Proxy
  await withErrorHandling(async () => {
    console.log("Deploying Expeditions Proxy...");
    
    const TotemExpeditions = await ethers.getContractFactory("TotemExpeditions", signer);
    const TotemProxy = await ethers.getContractFactory("TotemProxy", signer);
    
    const initExpeditionsData = TotemExpeditions.interface.encodeFunctionData("initialize", [
      getAddress("gameProxy"),
      getAddress("tokenProxy"),
      getAddress("nftProxy"),
      getAddress("trustedForwarder")
    ]);

    const expeditionsProxy = await TotemProxy.deploy(
      getAddress("expeditionsImplementation"),
      getAddress("proxyAdmin"),
      initExpeditionsData
    );
    await expeditionsProxy.waitForDeployment();
    
    const expeditionsProxyAddress = await expeditionsProxy.getAddress();
    context.state.deployedContracts["expeditionsProxy"] = {
      address: expeditionsProxyAddress,
      implementation: getAddress("expeditionsImplementation"),
      proxy: expeditionsProxyAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: expeditionsProxy.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ Expeditions Proxy deployed:", expeditionsProxyAddress);
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.CONTRACT_INITIALIZATION;
  console.log("\n✅ Phase 3 Complete: All proxies deployed and initialized");
}

export function getProxyDeploymentSteps(): DeploymentStep[] {
  return [
    { 
      id: "token-proxy", 
      name: "Deploy Token Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["tokenImplementation", "proxyAdmin", "priceOracle", "trustedForwarder"],
      optional: false,
      retryable: true
    },
    { 
      id: "nft-proxy", 
      name: "Deploy NFT Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["nftImplementation", "proxyAdmin", "trustedForwarder"],
      optional: false,
      retryable: true
    },
    { 
      id: "game-proxy", 
      name: "Deploy Game Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["gameImplementation", "proxyAdmin", "tokenProxy", "nftProxy", "trustedForwarder"],
      optional: false,
      retryable: true
    },
    { 
      id: "shop-proxy", 
      name: "Deploy Shop Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["shopImplementation", "proxyAdmin", "gameProxy", "tokenProxy", "nftProxy", "trustedForwarder"],
      optional: false,
      retryable: true
    },
    { 
      id: "rewards-proxy", 
      name: "Deploy Rewards Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["rewardsImplementation", "proxyAdmin", "gameProxy", "tokenProxy", "nftProxy", "trustedForwarder"],
      optional: false,
      retryable: true
    },
    { 
      id: "achievements-proxy", 
      name: "Deploy Achievements Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["achievementsImplementation", "proxyAdmin"],
      optional: false,
      retryable: true
    },
    { 
      id: "challenges-proxy", 
      name: "Deploy Challenges Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["challengesImplementation", "proxyAdmin"],
      optional: false,
      retryable: true
    },
    { 
      id: "expeditions-proxy", 
      name: "Deploy Expeditions Proxy", 
      phase: DeploymentPhase.PROXY_DEPLOYMENTS,
      dependencies: ["expeditionsImplementation", "proxyAdmin", "gameProxy", "tokenProxy", "nftProxy", "trustedForwarder"],
      optional: false,
      retryable: true
    }
  ];
}