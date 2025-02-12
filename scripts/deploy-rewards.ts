import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";

async function main() {
    const deployment = loadDeployment("localhost");
    const [deployer] = await ethers.getSigners();

    console.log("Configuring rewards with:", deployer.address);

    // Get TotemRewards contract at proxy address
    const rewards = await ethers.getContractAt(
        "TotemRewards",
        deployment.rewardsProxy
    );

    // Configure Daily Login Reward
    const dailyRewardId = ethers.id("daily_login");
    const dailyConfig = {
        baseAmount: ethers.parseEther("10"),     // 10 TOTEM
        interval: 86400,                         // 24 hours
        streakBonus: 5,                          // 5% per day
        maxStreakBonus: 100,                     // Max 100% bonus
        minStreak: 0,                            // No minimum
        gracePeriod: 7200,                       // 2-hour grace period
        allowProtection: true,
        enabled: true,
        protectionTierCount: 2                   // Two protection tiers for daily
    };

    console.log("\nConfiguring Daily Login Reward...");
    const dailyTx = await rewards.configureReward(
        dailyRewardId,
        "Daily Login",
        "Claim TOTEM tokens every day and build your streak!",
        "ipfs://daily-login-icon",
        dailyConfig
    );
    await dailyTx.wait();
    console.log("Daily reward configured, tx:", dailyTx.hash);

    // Configure protection tiers for daily reward
    console.log("\nConfiguring Daily Protection Tiers...");
    
    // 1-day protection
    const tier1Tx = await rewards.configureProtectionTier(
        dailyRewardId,
        0,
        {
            cost: ethers.parseEther("50"),      // 50 TOTEM
            duration: 86400,                    // 1 day
            requiredStreak: 7,                  // Need 7-day streak
            enabled: true
        }
    );
    await tier1Tx.wait();
    console.log("Tier 1 configured, tx:", tier1Tx.hash);

    // 7-day protection
    const tier2Tx = await rewards.configureProtectionTier(
        dailyRewardId,
        1,
        {
            cost: ethers.parseEther("250"),     // 250 TOTEM
            duration: 604800,                   // 7 days
            requiredStreak: 14,                 // Need 14-day streak
            enabled: true
        }
    );
    await tier2Tx.wait();
    console.log("Tier 2 configured, tx:", tier2Tx.hash);

    // Configure Weekly Bonus
    const weeklyRewardId = ethers.id("weekly_bonus");
    const weeklyConfig = {
        baseAmount: ethers.parseEther("100"),    // 100 TOTEM
        interval: 604800,                        // 7 days
        streakBonus: 10,                         // 10% per week
        maxStreakBonus: 100,                     // Max 100% bonus
        minStreak: 1,                            // Require at least 1 week
        gracePeriod: 86400,                      // 1 day grace period
        allowProtection: true,
        enabled: true,
        protectionTierCount: 1                   // One protection tier for weekly
    };

    console.log("\nConfiguring Weekly Bonus Reward...");
    const weeklyTx = await rewards.configureReward(
        weeklyRewardId,
        "Weekly Bonus",
        "Earn bonus TOTEM tokens for consistent weekly participation!",
        "ipfs://weekly-bonus-icon",
        weeklyConfig
    );
    await weeklyTx.wait();
    console.log("Weekly reward configured, tx:", weeklyTx.hash);

    // Configure weekly protection tier
    console.log("\nConfiguring Weekly Protection Tier...");
    const weeklyProtectionTx = await rewards.configureProtectionTier(
        weeklyRewardId,
        0,
        {
            cost: ethers.parseEther("500"),     // 500 TOTEM
            duration: 1209600,                  // 14 days
            requiredStreak: 4,                  // Need 4-week streak
            enabled: true
        }
    );
    await weeklyProtectionTx.wait();
    console.log("Weekly protection tier configured, tx:", weeklyProtectionTx.hash);

    // Add metadata attributes for both rewards
    console.log("\nSetting Reward Metadata...");
    
    // Daily reward metadata
    await (await rewards.setRewardMetadataAttribute(
        dailyRewardId,
        "category",
        "login"
    )).wait();

    await (await rewards.setRewardMetadataAttribute(
        dailyRewardId,
        "tier",
        "basic"
    )).wait();

    // Weekly reward metadata
    await (await rewards.setRewardMetadataAttribute(
        weeklyRewardId,
        "category",
        "bonus"
    )).wait();

    await (await rewards.setRewardMetadataAttribute(
        weeklyRewardId,
        "tier",
        "advanced"
    )).wait();

    console.log("Reward metadata configured");

    // Enable rewards
    console.log("\nEnabling rewards...");
    await (await rewards.enableReward(dailyRewardId)).wait();
    await (await rewards.enableReward(weeklyRewardId)).wait();

    // Verify final configuration
    console.log("\nVerifying configurations...");
    const rewardIds = await rewards.getRewardIds();
    console.log(`Found ${rewardIds.length} configured rewards:`);
    
    for (const id of rewardIds) {
        const [name, description, , config] = await rewards.getRewardInfo(id);
        console.log(`\nReward: ${name}`);
        console.log(`Description: ${description}`);
        console.log(`Base Amount: ${ethers.formatEther(config.baseAmount)} TOTEM`);
        console.log(`Streak Bonus: ${config.streakBonus}%`);
        console.log(`Max Bonus: ${config.maxStreakBonus}%`);
        console.log(`Protection Tiers: ${config.protectionTierCount}`);
        
        // Check metadata
        const category = await rewards.getMetadataAttribute(id, "category");
        const tier = await rewards.getMetadataAttribute(id, "tier");
        console.log(`Category: ${category}`);
        console.log(`Tier: ${tier}`);
        
        // Verify claiming status for deployer
        const canClaim = await rewards.isClaimingAllowed(id, deployer.address);
        console.log(`Can claim: ${canClaim}`);
    }

    console.log("\nReward system deployment and configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });