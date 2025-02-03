import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemGame, TotemNFT, TotemToken } from "../typechain-types";
import { TotemAchievements } from "../typechain-types";

async function main() {
    const deployment = loadDeployment("localhost");
    // Add this to the contract instances section
    const achievements = await ethers.getContractAt(
        "TotemAchievements",
        deployment.achievementsProxy
    ) as unknown as TotemAchievements;

    // Add this section before the closing of main()
    console.log("\n=== Achievements Statistics ===");

    // Get all achievement IDs
    const achievementIds = await achievements.getAchievementIds();
    console.log(`Total Configured Achievements: ${achievementIds.length}`);

    // Track achievement type distribution
    const achievementTypeCount = {
        Evolution: 0,
        Collection: 0,
        Streak: 0,
        Action: 0
    };
    
    // Achievement type names to match the enum in the test
    const achievementTypeNames = [
        'Evolution', 
        'Collection', 
        'Streak', 
        'Action'
    ];

    // Detailed achievement information
    console.log("\nAchievement Details:");
    for (const id of achievementIds) {
        const achievement = await achievements.getAchievement(id);
        const typeName = achievementTypeNames[Number(achievement.achievementType)];
        achievementTypeCount[typeName as keyof typeof achievementTypeCount]++;

        console.log(`\nName: ${achievement.name}`);
        console.log(`Description: ${achievement.description}`);
        console.log(`Type: ${typeName}`);
        console.log(`Requirement: ${achievement.requirement}`);
        console.log(`Enabled: ${achievement.enabled}`);
    }

    // Print achievement type distribution
    console.log("\nAchievement Type Distribution:");
    Object.entries(achievementTypeCount).forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
    });

    // Track user achievement stats (using addr1 as an example)
    //const [, addr1] = await ethers.getSigners();
    const addr1 = { address: "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199" };
    console.log("\nUser Achievement Statistics:");
    console.log(`Address: ${addr1.address}`);

    // Get highest stage unlocked
    const highestStage = await achievements.getHighestStageUnlocked(addr1.address);
    console.log(`Highest Stage Unlocked: ${highestStage}`);

    // Track unlocked achievements
    let unlockedAchievementsCount = 0;
    const unlockedAchievements = [];

    for (const id of achievementIds) {
        const hasAchievement = await achievements.hasAchievement(id, addr1.address);
        if (hasAchievement) {
            unlockedAchievementsCount++;
            const achievement = await achievements.getAchievement(id);
            unlockedAchievements.push(achievement.name);
        }
    }

    console.log(`Unlocked Achievements: ${unlockedAchievementsCount}`);
    console.log("Unlocked Achievement Names:", unlockedAchievements);

    // Optional: Track progress on some key achievements
    console.log("\nAchievement Progresses:");
    const keyAchievementIds = [
        ethers.id("stage_1"),
        ethers.id("stage_4"),
        ethers.id("first_totem"),
        ethers.id("caring_keeper")
    ];

    for (const id of keyAchievementIds) {
        try {
            const progress = await achievements.getProgress(id, addr1.address);
            const achievement = await achievements.getAchievement(id);
            
            console.log(`\nAchievement: ${achievement.name}`);
            console.log(`Current Progress: ${progress.count}`);
            console.log(`Requirement: ${achievement.requirement}`);
            console.log(`Achieved: ${progress.achieved}`);
            console.log(`Last Update: ${new Date(Number(progress.lastUpdate) * 1000).toLocaleString()}`);
        } catch (error) {
            console.log(`Could not fetch progress for achievement: ${id}`);
        }
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
