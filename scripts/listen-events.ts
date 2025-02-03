import { ethers } from 'hardhat';
import { loadDeployment } from './helpers';

async function listenToContractEvents() {
    const deployment = loadDeployment("localhost");

    // Contract configurations
    const contractConfigs = [
        {
            name: "TotemGame",
            address: deployment.gameProxy,
            contract: await ethers.getContractAt("TotemGame", deployment.gameProxy)
        },
        {
            name: "TotemNFT",
            address: deployment.totemNFTProxy,
            contract: await ethers.getContractAt("TotemNFT", deployment.totemNFTProxy)
        },
        {
            name: "TotemAchievements",
            address: deployment.achievementsProxy,
            contract: await ethers.getContractAt("TotemAchievements", deployment.achievementsProxy)
        },
        {
            name: "TotemRewards",
            address: deployment.rewardsProxy,
            contract: await ethers.getContractAt("TotemRewards", deployment.rewardsProxy)
        }
    ];

    // Simplified event logging
    const logEvent = (contractName: string) => (event: any) => {
        // Check if event has a name/fragment
        const eventName = event.fragment?.name || 'Unknown Event';
        const transactionHash = event.log?.transactionHash || 'N/A';
        const blockNumber = event.log?.blockNumber || 'N/A';

        console.log(`📡 ${contractName} Event: ${eventName}`);
        console.log(`Tx Hash: ${transactionHash}`);
        console.log(`Block: ${blockNumber}`);
        
        // Simplified args logging
        if (event.args) {
            console.log('Args:', event.args.map(arg => arg.toString()).join(', '));
        }
        
        console.log('-'.repeat(40));
    };

    // Listen to each contract separately
    for (const config of contractConfigs) {
        console.log(`Listening to events for ${config.name}`);
        config.contract.on("*", logEvent(config.name));
    }

    console.log("\n🌐 Waiting for events. Press Ctrl+C to stop.");

    // Prevent script from exiting
    await new Promise(() => {});
}

listenToContractEvents()
    .then()
    .catch(console.error);