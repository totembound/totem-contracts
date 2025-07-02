import { network } from "hardhat";
import { EnhancedDeployer } from "./enhanced-deployer";
import { CheckpointManager } from "./utils/checkpoint-manager";

async function main() {
  const networkName = network.name;
  const command = process.env.COMMAND || process.argv[2] || 'status';
  
  switch (command) {
    case 'status':
      await showDeploymentStatus(networkName);
      break;
      
    case 'checkpoints':
      await listCheckpoints(networkName);
      break;
      
    case 'resume':
      await resumeDeployment(networkName, process.argv[3]);
      break;
      
    case 'cleanup':
      await cleanupCheckpoints(networkName);
      break;
      
    default:
      showHelp();
  }
}

async function showDeploymentStatus(networkName: string) {
  console.log(`\n📊 Deployment Status for ${networkName}`);
  console.log("================================");
  
  const summary = await EnhancedDeployer.getDeploymentSummary(networkName);
  
  if (!summary) {
    console.log("❌ No deployment found");
    return;
  }
  
  console.log(`Phase: ${summary.phase}`);
  console.log(`Contracts Deployed: ${summary.contractsDeployed}`);
  console.log(`Total Gas Used: ${summary.totalGasUsed}`);
  console.log(`Started: ${new Date(summary.startTime).toLocaleString()}`);
  console.log(`Checkpoints: ${summary.checkpoints}`);
  
  const canResume = await EnhancedDeployer.canResume(networkName);
  console.log(`Can Resume: ${canResume ? '✅' : '❌'}`);
}

async function listCheckpoints(networkName: string) {
  console.log(`\n📍 Checkpoints for ${networkName}`);
  console.log("========================");
  
  const checkpoints = await EnhancedDeployer.listCheckpoints(networkName);
  
  if (checkpoints.length === 0) {
    console.log("No checkpoints found");
    return;
  }
  
  checkpoints.forEach((checkpoint, index) => {
    console.log(`${index + 1}. ${checkpoint}`);
  });
  
  console.log(`\nUse: COMMAND=resume npx hardhat run scripts/deployment-utils.ts --network ${networkName} to resume from latest`);
}

async function resumeDeployment(networkName: string, checkpointId?: string) {
  console.log(`\n🔄 Resuming deployment for ${networkName}`);
  console.log("==================================");
  
  if (checkpointId) {
    console.log(`From checkpoint: ${checkpointId}`);
  } else {
    console.log("From latest checkpoint");
  }
  
  const deployer = new EnhancedDeployer({ network: networkName });
  const result = await deployer.resume(checkpointId);
  
  if (result.success) {
    console.log("✅ Deployment resumed and completed successfully");
  } else {
    console.log("❌ Deployment resume failed");
  }
}

async function cleanupCheckpoints(networkName: string) {
  console.log(`\n🗑️  Cleaning up old checkpoints for ${networkName}`);
  console.log("=========================================");
  
  const checkpointManager = new CheckpointManager(networkName);
  await checkpointManager.cleanup(7); // Clean up checkpoints older than 7 days
  
  console.log("✅ Cleanup completed");
}

function showHelp() {
  console.log(`
Deployment Utilities

Usage with hardhat:
  COMMAND=<command> npx hardhat run scripts/deployment-utils.ts --network <network>

Commands:
  status        Show current deployment status
  checkpoints   List all available checkpoints
  resume        Resume deployment from latest checkpoint
  cleanup       Clean up old checkpoints (>7 days)

Examples:
  COMMAND=status npx hardhat run scripts/deployment-utils.ts --network localhost
  COMMAND=checkpoints npx hardhat run scripts/deployment-utils.ts --network localhost
  COMMAND=resume npx hardhat run scripts/deployment-utils.ts --network localhost
  COMMAND=cleanup npx hardhat run scripts/deployment-utils.ts --network localhost

Direct node usage:
  COMMAND=status node -r ts-node/register -r hardhat/register scripts/deployment-utils.ts
`);
}

main().catch(console.error);