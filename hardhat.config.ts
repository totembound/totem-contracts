import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "dotenv/config";
import fs from "fs";
import path from "path";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  defaultNetwork: "hardhat",
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  networks: {
    hardhat: {
      chainId: 31337, // Local Hardhat chain ID
      mining: {
        auto: true,
        interval: 0
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    }
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [], // optional: only show specific contracts
  }
};

const CONTRACTS = ["TotemGame", "TotemNFT", "TotemRewards", "TotemAchievements", "TotemToken", "TotemChallenges", "TotemShop", "TotemTrustedForwarder"];

task("export-abi", "Exports contract ABIs to frontend or API")
  .addOptionalParam("dest", "Destination repository (app or api)", "app")
  .setAction(async (taskArgs, { artifacts }) => {
    // Determine the destination path based on the parameter
    const destination = taskArgs.dest.toLowerCase();
    let targetPath;
    
    if (destination === "api") {
      targetPath = "../totem-api/src/contracts";
    } else {
      // Default to app
      targetPath = "../totem-app/src/contracts";
    }
    
    console.log(`Exporting ABIs to: ${targetPath}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    for (const contractName of CONTRACTS) {
      try {
        const artifact = await artifacts.readArtifact(contractName);
        const filePath = path.join(targetPath, `${contractName}.abi.json`);
        fs.writeFileSync(filePath, JSON.stringify(artifact.abi, null, 2));
        console.log(`✅ ABI exported: ${filePath}`);
      } catch (error: any) {
          console.error(`❌ Error exporting ABI for ${contractName}:`, error.message);
      }
    }
});

export default config;

