import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;
  const deployment = loadDeployment(networkName);

  console.log("Testing Oracle with:", deployer.address);

  // Get the oracle contract address from your deployment or .env file
  let oracleAddress = deployment.randomOracle || process.env.ORACLE_ADDRESS!;
  console.log(`Using oracle at: ${oracleAddress}`);

  // Get oracle contract instance
  const oracleABI = [
    "event RandomnessRequested(uint256 indexed requestId, address requester)",
    "event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords)",
    "function getCacheStatus() external view returns (uint256 available, uint256 total, bool pendingRefill, uint256 lowThreshold)",
    "function refillCache() external",
    "function requestRandomness(uint32 numWords) external returns (uint256)",
    "function getRequestStatus(uint256 _requestId) external view returns (bool fulfilled, uint256[] memory randomWords)",
    "function owner() external view returns (address)",
    "function updateBatchSize(uint32 newBatchSize) external",
    "function updateCallbackGasLimit(uint32 newLimit) external",
    "function resetPendingRefillFlag() external",
  ];

  const oracle = new ethers.Contract(oracleAddress, oracleABI, deployer);

  try {
    // Check if we're the owner
    const owner = await oracle.owner();
    const isOwner = owner.toLowerCase() === deployer.address.toLowerCase();

    if (!isOwner) {
      console.log(
        `WARNING: ${deployer.address} is not the oracle owner (${owner})`
      );
      console.log("Cannot refill cache without owner permissions.");
      return;
    }

    // Check initial status
    console.log("\nChecking initial cache status...");
    const [available, total, pendingRefill, lowThreshold] =
      await oracle.getCacheStatus();

    console.log("============= CACHE STATUS =============");
    console.log(`Available: ${available.toString()} / ${total.toString()}`);
    console.log(`Low Threshold: ${lowThreshold.toString()}`);
    console.log(`Pending Refill: ${pendingRefill ? "Yes" : "No"}`);
    console.log("========================================");

    // Get command line arguments
    const args = process.argv.slice(2);

    if (args.includes("--request-random")) {
      // Try to request randomness if we have some available
      const [newAvailable] = await oracle.getCacheStatus();
      if (Number(newAvailable) > 0) {
        console.log("\nRequesting a random number from the cache...");

        const gasLimit = 500000;
        const tx = await oracle.requestRandomness(1, {
          gasLimit,
        });
        console.log(`Request transaction sent: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`Request confirmed in block ${receipt.blockNumber}`);
        const logs = receipt.logs;

        // Extract request ID from events
        const requestEvent = logs.find(
          (log: { topics: string[] }) =>
            // This topic is the event signature hash for RandomnessRequested
            log.topics[0] ===
            "0x28f521cf7abd0044cba5bb040c5217ff69a4e5865f5262905018698e68fe7d00"
        );

        if (requestEvent) {
          const requestId = requestEvent.args[0];
          console.log(`Request ID: ${requestId}`);

          // Get random values
          const [fulfilled, randomWords] = await oracle.getRequestStatus(
            requestId
          );
          console.log(`Request fulfilled: ${fulfilled}`);
          if (fulfilled) {
            console.log(`Random value: ${randomWords[0].toString()}`);
          }
        }
        else {
          console.log("Could not find request event in logs");
        }
      }
      else {
        console.log(
          "\nNo randomness available in cache yet. Try again after VRF fulfillment."
        );
      }
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
