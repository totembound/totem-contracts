import { ethers, network } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function deployInfrastructure(context: DeploymentContext): Promise<void> {
  const { signer, provider } = context;
  const networkName = network.name;
  const address = await signer.getAddress();
  
  console.log("\n🏗️  Phase 1: Infrastructure Deployment");
  console.log("=====================================");

  // Deploy TotemAdminPriceOracle
  await withErrorHandling(async () => {
    console.log("Deploying TotemAdminPriceOracle...");
    const TotemAdminPriceOracle = await ethers.getContractFactory("TotemAdminPriceOracle", signer);
    const initialPrice = ethers.parseUnits("0.01", "ether");
    const adminOracle = await TotemAdminPriceOracle.deploy(initialPrice);
    await adminOracle.waitForDeployment();
    
    const oracleAddress = await adminOracle.getAddress();
    context.state.deployedContracts["priceOracle"] = {
      address: oracleAddress,
      verified: false,
      gasUsed: 0n, // Will be updated by gas tracker
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: adminOracle.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ TotemAdminPriceOracle deployed:", oracleAddress);
  }, context, context.errorHandler);

  // Deploy Random Oracle (network-specific)
  await withErrorHandling(async () => {
    let randomOracleAddress = '';
    
    if (networkName === "localhost" || networkName === "hardhat") {
      console.log("Deploying MockRandomOracle for local development...");
      const MockRandomOracle = await ethers.getContractFactory("MockRandomOracle", signer);
      const mockRandomOracle = await MockRandomOracle.deploy();
      await mockRandomOracle.waitForDeployment();
      randomOracleAddress = await mockRandomOracle.getAddress();
      console.log("✅ MockRandomOracle deployed:", randomOracleAddress);
    } else {
      console.log("Deploying TotemCachedRandomOracle for testnet/mainnet...");
      
      const subscriptionId = process.env.VRF_SUBSCRIPTION_ID || "";
      const vrfCoordinator = process.env.VRF_COORDINATOR || "";
      const keyHash = process.env.VRF_KEY_HASH || "";
      
      if (!subscriptionId || !vrfCoordinator || !keyHash) {
        throw new Error("Missing required VRF configuration");
      }
      
      const TotemCachedRandomOracle = await ethers.getContractFactory("TotemCachedRandomOracle", signer);
      const cachedOracle = await TotemCachedRandomOracle.deploy(
        subscriptionId,
        vrfCoordinator,
        keyHash
      );
      await cachedOracle.waitForDeployment();
      randomOracleAddress = await cachedOracle.getAddress();
      console.log("✅ TotemCachedRandomOracle deployed:", randomOracleAddress);
    }

    context.state.deployedContracts["randomOracle"] = {
      address: randomOracleAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: ""
    };
  }, context, context.errorHandler);

  // Deploy TotemTrustedForwarder
  await withErrorHandling(async () => {
    console.log("Deploying TotemTrustedForwarder...");
    const TotemTrustedForwarder = await ethers.getContractFactory("TotemTrustedForwarder", signer);
    const maxGasPrice = ethers.parseUnits("100", "gwei");
    const forwarder = await TotemTrustedForwarder.deploy(maxGasPrice);
    await forwarder.waitForDeployment();
    
    const forwarderAddress = await forwarder.getAddress();
    context.state.deployedContracts["trustedForwarder"] = {
      address: forwarderAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: forwarder.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ TotemTrustedForwarder deployed:", forwarderAddress);
  }, context, context.errorHandler);

  // Deploy ProxyAdmin
  await withErrorHandling(async () => {
    console.log("Deploying ProxyAdmin...");
    const TotemProxyAdmin = await ethers.getContractFactory("TotemProxyAdmin", signer);
    const proxyAdmin = await TotemProxyAdmin.deploy(address);
    await proxyAdmin.waitForDeployment();
    
    const proxyAdminAddress = await proxyAdmin.getAddress();
    context.state.deployedContracts["proxyAdmin"] = {
      address: proxyAdminAddress,
      verified: false,
      gasUsed: 0n,
      blockNumber: await provider.getBlockNumber(),
      timestamp: new Date(),
      transactionHash: proxyAdmin.deploymentTransaction()?.hash || ""
    };
    
    console.log("✅ ProxyAdmin deployed:", proxyAdminAddress);
  }, context, context.errorHandler);

  context.state.phase = DeploymentPhase.CORE_IMPLEMENTATIONS;
  console.log("\n✅ Phase 1 Complete: Infrastructure deployed");
}

export function getInfrastructureSteps(): DeploymentStep[] {
  return [
    { 
      id: "price-oracle", 
      name: "Deploy Price Oracle", 
      phase: DeploymentPhase.INFRASTRUCTURE,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "random-oracle", 
      name: "Deploy Random Oracle", 
      phase: DeploymentPhase.INFRASTRUCTURE,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "trusted-forwarder", 
      name: "Deploy Trusted Forwarder", 
      phase: DeploymentPhase.INFRASTRUCTURE,
      dependencies: [], 
      optional: false, 
      retryable: true 
    },
    { 
      id: "proxy-admin", 
      name: "Deploy Proxy Admin", 
      phase: DeploymentPhase.INFRASTRUCTURE,
      dependencies: [], 
      optional: false, 
      retryable: true 
    }
  ];
}