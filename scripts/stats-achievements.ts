import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemAchievements } from "../typechain-types";

async function main() {
    const deployment = loadDeployment("localhost");
    const achievements = await ethers.getContractAt(
        "TotemAchievements",
        deployment.achievementsProxy
    ) as unknown as TotemAchievements;

    console.log("\n=== Achievements Statistics ===");

    // Get all achievement IDs
    const achievementIds = await achievements.getAchievementIds();

     // Track total achievements and milestones
     let totalOneTimeAchievements = 0;
     let totalMilestones = 0;

     // Get achievement details to count types and milestones
     for (const id of achievementIds) {
        const achievement = await achievements.getAchievement(id);
        if (Number(achievement.achievementType) === 0) { // OneTime
            totalOneTimeAchievements++;
        } else { // Progression
            totalMilestones += achievement.milestones.length;
        }
    }

    console.log(`Total Configured Achievements: ${achievementIds.length}`);
    console.log(`- One-Time Achievements: ${totalOneTimeAchievements}`);
    console.log(`- Progression Achievements: ${achievementIds.length - totalOneTimeAchievements}`);
    console.log(`- Progression Milestones: ${totalMilestones}`);
    console.log(`Total Achievable Goals: ${totalOneTimeAchievements + totalMilestones}`);

    // Achievement category names
    const categoryNames = [
        'Evolution',
        'Collection',
        'Streak',
        'Action',
        'Challenge',
        'Expedition'
    ];

    // Track category distribution using the new getUserCategoriesProgress function
    const addr1 = { address: "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199" };
    const categoryProgress = await achievements.getUserCategoriesProgress(addr1.address);
    
    console.log("\nAchievement Category Distribution:");
    // Get all achievements by category to count types correctly
    for (let i = 0; i < categoryNames.length; i++) {
        const categoryAchievements = await achievements.getAchievementsByCategory(i);
        const progress = categoryProgress[i];
        
        let oneTimeCount = 0;
        let progressionMilestones = 0;
        
        // Count achievements by type
        categoryAchievements.forEach(achievement => {
            if (Number(achievement.achievementType) === 0) { // OneTime
                oneTimeCount++;
            } else { // Progression
                progressionMilestones += achievement.milestones.length;
            }
        });
        
        console.log(`${categoryNames[i]}:`);
        console.log(`  One-Time Achievements: ${oneTimeCount}`);
        console.log(`  Progression Milestones: ${progressionMilestones}`);
        console.log(`  Total Goals: ${oneTimeCount + progressionMilestones}`);
        console.log(`  Completed Goals: ${progress.completedAchievements + progress.unlockedMilestones}`);
    };
    
    // Get user's completed achievements
    const completedAchievements = await achievements.getUserCompletedAchievements(addr1.address);
    
    console.log("\nUser Achievement Statistics:");
    console.log(`Address: ${addr1.address}`);
    console.log(`Total Completed Goals: ${completedAchievements.length}`);
    
    if (completedAchievements.length > 0) {
        console.log("\nCompleted Achievement Details:");
        for (const achievement of completedAchievements) {
            console.log(`\nName: ${achievement.name}`);
            console.log(`Description: ${achievement.description}`);
            console.log(`Type: ${Number(achievement.achievementType) === 0 ? 'OneTime' : 'Progression'}`);
            if (achievement.milestones.length > 0) {
                console.log("Milestones:");
                achievement.milestones.forEach((milestone, index) => {
                    console.log(`  ${index + 1}. ${milestone.name} (Requirement: ${milestone.requirement})`);
                });
            }
        }
    }

    // Check specific achievements progress
    console.log("\nDetailed Achievement Progress:");
    const keyAchievements = [
        { id: ethers.id("login_progression"), category: 2 },     // Streak
        { id: ethers.id("evolution_progression"), category: 0 }, // Evolution
        { id: ethers.id("collector_progression"), category: 1 }, // Collection
        { id: ethers.id("train_progression"), category: 3 }      // Action
    ];

    const categoryViews = new Map<number, Awaited<ReturnType<typeof achievements.getAchievementsByCategory>>>();

    for (const { id, category } of keyAchievements) {
        try {
            const progress = await achievements.getDetailedProgress(id, addr1.address);
            
            if (!categoryViews.has(category)) {
                categoryViews.set(
                    category, 
                    await achievements.getAchievementsByCategory(category)
                );
            }
            
            const achievementView = categoryViews.get(category)?.find(a => a.id === id);

            if (achievementView) {
                console.log(`\nAchievement: ${achievementView.name}`);
                console.log(`Category: ${categoryNames[category]}`);
                console.log(`Current Progress: ${progress.count}`);
                console.log(`Achieved: ${progress.achieved}`);
                console.log(`Start Time: ${new Date(Number(progress.startTime) * 1000).toLocaleString()}`);
                console.log(`Last Update: ${new Date(Number(progress.lastUpdate) * 1000).toLocaleString()}`);
                
                if (progress.unlockedMilestones.length > 0) {
                    console.log("Unlocked Milestones:");
                    progress.unlockedMilestones.forEach((unlocked, index) => {
                        if (unlocked) {
                            console.log(`  - ${achievementView.milestones[index].name}`);
                        }
                    });
                }
            }
        } catch (error) {
            console.log(`Could not fetch progress for achievement ID: ${id}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
