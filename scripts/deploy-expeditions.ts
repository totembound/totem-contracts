import { ethers, network } from "hardhat";
import { loadDeployment, saveDeployment } from "./helpers";
import { TotemExpeditions, TotemProxyAdmin, TotemAchievements } from "../typechain-types";

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;
    console.log("Deploying TotemExpeditions contract with:", deployer.address);
    
    // Load existing deployment info
    const deployment = loadDeployment(networkName);
    
    const achievements = await ethers.getContractAt(
        "TotemAchievements",
        deployment.achievementsProxy
    ) as TotemAchievements;

    // Deploy implementation
    console.log("\nDeploying TotemExpeditions implementation...");
    const TotemExpeditionsFactory = await ethers.getContractFactory("TotemExpeditions");
    const expeditionsImplementation = await TotemExpeditionsFactory.deploy();
    await expeditionsImplementation.waitForDeployment();
    const expeditionsImplementationAddress = await expeditionsImplementation.getAddress();
    console.log("TotemExpeditions implementation deployed to:", expeditionsImplementationAddress);
    
    // Get ProxyAdmin
    console.log("\nLoading ProxyAdmin...");
    const proxyAdmin = await ethers.getContractAt("TotemProxyAdmin", deployment.proxyAdmin) as TotemProxyAdmin;
    
    // Prepare initialization data
    const initData = TotemExpeditionsFactory.interface.encodeFunctionData("initialize", [
        deployment.gameProxy,          // TotemGame address
        deployment.tokenProxy,         // TotemToken address
        deployment.totemNFTProxy,      // TotemNFT address
        deployment.totemTrustedForwarder // Trusted forwarder address
    ]);
    
    // Deploy Proxy for TotemExpeditions
    console.log("\nDeploying Expeditions Proxy...");
    const TotemProxy = await ethers.getContractFactory("TotemProxy");
    const expeditionsProxy = await TotemProxy.deploy(
        expeditionsImplementationAddress,
        deployment.proxyAdmin,
        initData
    );
    await expeditionsProxy.waitForDeployment();
    const expeditionsProxyAddress = await expeditionsProxy.getAddress();
    console.log("Expeditions Proxy deployed to:", expeditionsProxyAddress);
    
    // Set game contract in expeditions
    console.log("\nSetting game contract in expeditions...");
    const game = await ethers.getContractAt("TotemGame", deployment.gameProxy);
    const expeditions = await ethers.getContractAt("TotemExpeditions", expeditionsProxyAddress) as TotemExpeditions;
    await (await expeditions.setGame(deployment.gameProxy)).wait();
    console.log("Game contract set in expeditions");

    // Also, the game contract needs to set the expeditions contract
    console.log("\nSetting expeditions contract in game...");
    await (await game.setExpeditions(expeditionsProxyAddress)).wait();
    console.log("Expeditions contract set in game");

    // Set achievements contract in TotemExpeditions
    console.log("\nSetting achievements contract...");
    await (await expeditions.setAchievements(deployment.achievementsProxy)).wait();
    const authExpeditionsTx = await achievements.authorize(expeditionsProxyAddress);
    await authExpeditionsTx.wait();
    console.log("Achievements contract set");
    
    // Add forwarder to trusted contracts
    console.log("\nUpdating forwarder contract status...");
    const forwarder = await ethers.getContractAt("TotemTrustedForwarder", deployment.totemTrustedForwarder);
    await (await forwarder.setContractStatus(expeditionsProxyAddress, true)).wait();
    console.log("Expeditions proxy added to trusted contracts");

    // Update deployment info
    console.log("\nUpdating deployment info...");
    const updatedDeployment = {
        ...deployment,
        expeditionsImplementation: expeditionsImplementationAddress,
        expeditionsProxy: expeditionsProxyAddress
    };
    saveDeployment(networkName, updatedDeployment);
    
    console.log("\nConfiguring expeditions...");
    
    // Helper function to convert hours to seconds
    const hoursToSeconds = (hours: number) => hours * 60 * 60;
    
    // Configuration for 3-hour expeditions
    const threeHourExpeditions = [
        {
            id: "harvesting-run",
            name: "Harvesting Run",
            domain: 0, // Land
            duration: 180,// hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 0, 0] // 100% Lesser, 0% Greater, 0% Ancient
        },
        {
            id: "wind-scout-patrol",
            name: "Wind Scout Patrol",
            domain: 1, // Air
            duration: 180, // hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 0, 0] // 100% Lesser, 0% Greater, 0% Ancient
        },
        {
            id: "quick-study-ritual",
            name: "Quick Study Ritual",
            domain: 2, // Water
            duration: 120, // hoursToSeconds(3),
            totemCost: ethers.parseUnits("5", 18), // 5 TOTEM
            happinessCost: 5,
            baseExp: 15, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 0, 0] // 100% Lesser, 0% Greater, 0% Ancient
        }
    ];
    
    // Configuration for 6-hour expeditions
    const sixHourExpeditions = [
        {
            id: "ruins-recovery",
            name: "Ruins Recovery",
            domain: 0, // Land
            duration: 120,// hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 25, 0] // 100% Lesser, 25% Greater, 0% Ancient
        },
        {
            id: "diplomatic-envoy",
            name: "Diplomatic Envoy",
            domain: 1, // Air
            duration: hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 25, 0] // 100% Lesser, 25% Greater, 0% Ancient
        },
        {
            id: "basic-research-mission",
            name: "Basic Research Mission",
            domain: 2, // Water
            duration: hoursToSeconds(6),
            totemCost: ethers.parseUnits("10", 18), // 10 TOTEM
            happinessCost: 10,
            baseExp: 30, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 25, 0] // 100% Lesser, 25% Greater, 0% Ancient
        }
    ];
    
    // Configuration for 12-hour expeditions
    const twelveHourExpeditions = [
        {
            id: "warden-patrol",
            name: "Warden Patrol",
            domain: 0, // Land
            duration: hoursToSeconds(12),
            totemCost: 120, // ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 50, 10] // 100% Lesser, 50% Greater, 10% Ancient
        },
        {
            id: "festival-envoy",
            name: "Festival Envoy",
            domain: 1, // Air
            duration: hoursToSeconds(12),
            totemCost: ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 50, 10] // 100% Lesser, 50% Greater, 10% Ancient
        },
        {
            id: "sigil-synthesis",
            name: "Sigil Synthesis",
            domain: 2, // Water
            duration: hoursToSeconds(12),
            totemCost: ethers.parseUnits("15", 18), // 15 TOTEM
            happinessCost: 15,
            baseExp: 60, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 50, 10] // 100% Lesser, 50% Greater, 10% Ancient
        }
    ];
    
    // Configuration for 24-hour expeditions
    const twentyFourHourExpeditions = [
        {
            id: "deep-exploration",
            name: "Deep Exploration",
            domain: 0, // Land
            duration: 120, // hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [1, 8, 1], // Agility primary
            runeDropChances: [100, 75, 25] // 100% Lesser, 75% Greater, 25% Ancient
        },
        {
            id: "celestial-mapping",
            name: "Celestial Mapping",
            domain: 1, // Air
            duration: hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [1, 1, 8], // Wisdom primary
            runeDropChances: [100, 75, 25] // 100% Lesser, 75% Greater, 25% Ancient
        },
        {
            id: "spirit-diplomacy",
            name: "Spirit Diplomacy",
            domain: 2, // Water
            duration: hoursToSeconds(24),
            totemCost: ethers.parseUnits("20", 18), // 20 TOTEM
            happinessCost: 20,
            baseExp: 120, // 5 XP per hour
            affinityWeights: [8, 1, 1], // Strength primary
            runeDropChances: [100, 75, 25] // 100% Lesser, 75% Greater, 25% Ancient
        }
    ];
    
    // Deploy all expeditions
    const allExpeditions = [
        ...threeHourExpeditions,
        ...sixHourExpeditions,
        ...twelveHourExpeditions,
        ...twentyFourHourExpeditions
    ];
    
    for (const config of allExpeditions) {
        console.log(`Configuring ${config.name}...`);
        const tx = await expeditions.configureExpedition(
            config.id,
            config.name,
            config.domain,
            config.duration,
            config.totemCost,
            config.happinessCost,
            config.baseExp,
            config.affinityWeights as [number, number, number],
            config.runeDropChances as [number, number, number]
        );
        await tx.wait();
        console.log(`${config.name} configured!`);
    }
    
    console.log("\nTotemExpeditions deployment and configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
