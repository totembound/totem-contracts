import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";

async function main() {
  const networkName = network.name;
  const deployment = loadDeployment(networkName);

  let randomOracle = null;
  
  if (networkName === "localhost" || networkName === "hardhat") {
    randomOracle = await ethers.getContractAt("MockRandomOracle", deployment.randomOracle);
  }
  else {
    randomOracle = await ethers.getContractAt("TotemCachedRandomOracle", deployment.randomOracle);
  }

  //await randomOracle.updateCallbackGasLimit(3000000);
  //await randomOracle.updateLowThreshold(25);
    
  console.log("Random Oracle updated");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
