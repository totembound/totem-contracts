import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Oracle with:", deployer.address);
  
  // Get configuration from environment
  const subscriptionId = process.env.VRF_SUBSCRIPTION_ID || "";
  const vrfCoordinator = process.env.VRF_COORDINATOR || "";
  const keyHash = process.env.VRF_KEY_HASH || "";
  
  if (!subscriptionId || !vrfCoordinator || !keyHash) {
    throw new Error("Missing required VRF configuration");
  }

  console.log("VRF Configuration:");
  console.log(`  Subscription ID: ${subscriptionId}`);
  console.log(`  VRF Coordinator: ${vrfCoordinator}`);
  console.log(`  Key Hash: ${keyHash}`);
  
  // Deploy cached oracle contract
  console.log("\nDeploying TotemCachedRandomOracle...");
  const TotemCachedRandomOracle = await ethers.getContractFactory("TotemCachedRandomOracle");
  const oracle = await TotemCachedRandomOracle.deploy(
    subscriptionId,
    vrfCoordinator,
    keyHash
  );
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("TotemCachedRandomOracle deployed to:", oracleAddress);
  
  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    randomOracle: oracleAddress,
    vrfCoordinator,
    subscriptionId,
    keyHash,
    timestamp: new Date().toISOString(),
    deployer: deployer.address
  };
  
  // Save to a separate file to avoid overwriting main deployment
  const fs = require('fs');
  fs.writeFileSync(
    `./deployments/oracle-${deploymentInfo.network}-${deploymentInfo.timestamp}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\nOracle deployment saved to file.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });