import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemAchievements } from "../typechain-types";

async function main() {
    const deployment = loadDeployment("localhost");
    const [deployer] = await ethers.getSigners();

    // Get TotemAchievements contract instance
    const achievements = await ethers.getContractAt(
        "TotemAchievements",
        deployment.achievementsProxy  // Assuming this is saved in deployment
    ) as TotemAchievements;

    console.log("Configuring achievements with:", deployer.address);

    // Initialize default achievements
    const achievementConfigs = [
        // Evolution Achievements
        {
            id: "stage_1",
            name: "Novice Evolution",
            description: "Evolve a totem to stage 1",
            iconUri: "ipfs://stage1-icon",
            requirement: 1,
            achievementType: 0, // Evolution
            subType: ethers.id("evolution_stage")
        },
        {
            id: "stage_2",
            name: "Adept Evolution",
            description: "Evolve a totem to stage 2",
            iconUri: "ipfs://stage2-icon",
            requirement: 2,
            achievementType: 0,
            subType: ethers.id("evolution_stage")
        },
        {
            id: "stage_3",
            name: "Master Evolution",
            description: "Evolve a totem to stage 3 - Unlocks Epic rarity",
            iconUri: "ipfs://stage3-icon",
            requirement: 3,
            achievementType: 0,
            subType: ethers.id("evolution_stage")
        },
        {
            id: "stage_4",
            name: "Elder Evolution",
            description: "Evolve a totem to stage 4 - Unlocks Legendary rarity",
            iconUri: "ipfs://stage4-icon",
            requirement: 4,
            achievementType: 0,
            subType: ethers.id("evolution_stage")
        },
        // Collection Achievements
        {
            id: "first_totem",
            name: "First Totem",
            description: "Mint your first NFT",
            iconUri: "ipfs://collection/first",
            requirement: 1,
            achievementType: 1, // Collection
            subType: ethers.id("mint_count")
        },
        {
            id: "rare_collector",
            name: "Rare Collector",
            description: "Own any Rare totem",
            iconUri: "ipfs://collection/rare",
            requirement: 1,
            achievementType: 1,
            subType: ethers.id("rarity_rare")
        },
        // Streak Achievements
        {
            id: "week_warrior",
            name: "Week Warrior",
            description: "Maintain a 7-day login streak",
            iconUri: "ipfs://streak/week",
            requirement: 7,
            achievementType: 2, // Streak
            subType: ethers.id("daily_login")
        },
        // Action Achievements
        {
            id: "caring_keeper",
            name: "Caring Keeper",
            description: "Feed your totem 100 times",
            iconUri: "ipfs://action/feed",
            requirement: 100,
            achievementType: 3, // Action
            subType: ethers.id("feed_count")
        }
    ];

    for (const config of achievementConfigs) {
        console.log(`Configuring achievement: ${config.name}`);
        await achievements.configureAchievement(
            config.id,
            config.name,
            config.description,
            config.iconUri,
            config.requirement,
            config.achievementType,
            config.subType
        );
    }

    console.log("\nReward system deployment and configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
