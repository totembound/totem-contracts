import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";

async function main() {
  const networkName = network.name;
  const deployment = loadDeployment(networkName);

  console.log("Checking oracle randomness cache status...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get the oracle contract address from your deployment or .env file
  let oracleAddress = deployment.randomOracle || process.env.ORACLE_ADDRESS!;
  console.log(`Using oracle at: ${oracleAddress}`);

  // Get oracle contract instance 
  const oracleABI = [
    "function getCacheStatus() external view returns (uint256 available, uint256 total, bool pendingRefill, uint256 lowThreshold)",
    "function refillCache() external",
    "function owner() external view returns (address)"
  ];
  
  const oracle = new ethers.Contract(oracleAddress, oracleABI, deployer);
  
  try {
    // Check if we're the owner
    const owner = await oracle.owner();
    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();
    
    // Check cache status
    const [available, total, pendingRefill, lowThreshold] = await oracle.getCacheStatus();
    
    console.log("============= CACHE STATUS =============");
    console.log(`Available: ${available.toString()} / ${total.toString()}`);
    console.log(`Low Threshold: ${lowThreshold.toString()}`);
    console.log(`Pending Refill: ${pendingRefill ? "Yes" : "No"}`);
    console.log("========================================");
    
    if (!isOwner) {
        console.log(`WARNING: ${deployer.address} is not the oracle owner (${owner})`);
        console.log("Cannot refill cache without owner permissions.");
        return;
    }

    // Determine if refill is needed
    if (available <= lowThreshold && !pendingRefill) {
        console.log("\nTriggering cache refill...");
        const tx = await oracle.refillCache();
        console.log(`Refill transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`Refill confirmed in block ${receipt.blockNumber}`);

        // Wait for VRF response (may take a few minutes)
        console.log(
          "\nWaiting for VRF response... (this may take a few minutes)"
        );

        // Poll cache status until we get some values
        let filled = false;
        for (let i = 0; i < 20; i++) {
          // Try up to 20 times
          await new Promise((r) => setTimeout(r, 15000)); // Wait 15 seconds

          const [newAvailable] = await oracle.getCacheStatus();
          console.log(
            `Cache check #${i + 1}: ${newAvailable.toString()} available`
          );

          if (Number(newAvailable) > 0) {
            filled = true;
            break;
          }
        }

        if (!filled) {
          console.log(
            "Cache didn't fill within the timeout period. VRF fulfillment may take longer."
          );
          console.log(
            "You can check the Chainlink VRF subscription manager to see pending requests."
          );
          return;
        }
        
        // Check status again after refill
        const [newAvailable, newTotal, newPendingRefill] = await oracle.getCacheStatus();
        console.log("\n============ UPDATED STATUS ============");
        console.log(`Available: ${newAvailable.toString()} / ${newTotal.toString()}`);
        console.log(`Pending Refill: ${newPendingRefill ? "Yes" : "No"}`);
        console.log("========================================");
    }
    else if (pendingRefill) {
      console.log("Cache refill is already pending. No action needed.");
    }
    else {
      console.log("Cache level is sufficient. No refill needed.");
    }
  }
  catch (error) {
    console.error("Error checking or refilling cache:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });