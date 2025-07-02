import { network } from "hardhat";
import { EnhancedDeployer } from "./enhanced-deployer";
import { DeploymentOptions } from "./types/deployment";

async function main() {
  const networkName = network.name;
  
  const options: DeploymentOptions = {
    network: networkName,
    retryAttempts: 3,
    //fromPhase: DeploymentPhase.INFRASTRUCTURE,
    //toPhase: DeploymentPhase.METADATA_CONFIG,
    interactiveMode: false,
    dryRun: false,
    forceFresh: true
  };
  
  const deployer = new EnhancedDeployer(options);
  
  try {
    let result;
    
    // Check if we should resume from checkpoint (unless forced fresh)
    if (!options.forceFresh && (options.resumeFromCheckpoint || await EnhancedDeployer.canResume(networkName))) {
      console.log("📍 Checkpoint found, resuming deployment...");
      result = await deployer.resume(options.resumeFromCheckpoint);
    } else {
      if (options.forceFresh) {
        console.log("🆕 Force fresh deployment (ignoring checkpoints)...");
      } else {
        console.log("🚀 Starting fresh deployment...");
      }
      result = await deployer.deploy(options);
    }
    
    if (result.success) {
      console.log("\n✅ Deployment Summary:");
      console.log("======================");
      console.log(`Network: ${networkName}`);
      console.log(`Contracts: ${Object.keys(result.deployedContracts).length}`);
      console.log(`Gas Used: ${result.totalGasUsed.toLocaleString()}`);
      console.log(`Duration: ${Math.round(result.duration / 1000)}s`);
      console.log(`Errors: ${result.errors.length}`);
      console.log(`Checkpoints: ${result.checkpoints.length}`);
      
      process.exit(0);
    } else {
      console.error("\n❌ Deployment failed");
      console.error(`Errors encountered: ${result.errors.length}`);
      console.error("Use --resume to continue from last checkpoint");
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Deployment error:", error);
    console.error("💡 Try using --resume to continue from last checkpoint");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});