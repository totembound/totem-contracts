import { ethers } from "hardhat";
import { TotemRewards } from "../typechain-types";
import chalk from "chalk";

const REWARDS_PROXY_ADDRESS = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";

function getRewardIds() {
  return {
    DAILY_LOGIN: ethers.id("daily_login"),
    WEEKLY_BONUS: ethers.id("weekly_bonus"),
    TUTORIAL_STEP_1: ethers.id("tutorial_step_1_signup"),
    TUTORIAL_STEP_2: ethers.id("tutorial_step_2_mint"),
    TUTORIAL_STEP_3: ethers.id("tutorial_step_3_care"),
    TUTORIAL_STEP_4: ethers.id("tutorial_step_4_challenge"),
    TUTORIAL_STEP_5: ethers.id("tutorial_step_5_evolve"),
    TUTORIAL_STEP_6: ethers.id("tutorial_step_6_explore"),
  };
}

async function main() {
  console.log(chalk.blue.bold("\n=== TOTEM REWARDS STATISTICS ===\n"));

  const [signer] = await ethers.getSigners();
  
  // Get user address from command line args or environment variable
  const args = process.argv.slice(2);
  let userAddress = signer.address;
  
  if (args.length > 0 && ethers.isAddress(args[0])) {
    userAddress = args[0];
  } else if (process.env.USER_ADDRESS && ethers.isAddress(process.env.USER_ADDRESS)) {
    userAddress = process.env.USER_ADDRESS;
  }

  console.log(chalk.gray(`Connected with: ${signer.address}`));
  console.log(chalk.gray(`Checking stats for user: ${userAddress}`));
  console.log(chalk.gray(`\nUsage: npx hardhat run scripts/stats-rewards.ts [userAddress] --network localhost`));
  console.log(chalk.gray(`   or: USER_ADDRESS=0x... npx hardhat run scripts/stats-rewards.ts --network localhost\n`));

  const TotemRewards = await ethers.getContractFactory("TotemRewards");
  const rewardsContract = TotemRewards.attach(REWARDS_PROXY_ADDRESS) as TotemRewards;

  try {
    await displayGeneralRewardStats(rewardsContract);
    console.log(chalk.blue.bold("\n=== USER SPECIFIC STATS ===\n"));
    await displayUserStats(rewardsContract, userAddress);
  } catch (error) {
    console.error(chalk.red("Error fetching rewards stats:"), error);
  }
}

async function displayGeneralRewardStats(contract: TotemRewards) {
  console.log(chalk.yellow.bold("Configured Rewards:"));
  
  const rewardIds = await contract.getRewardIds();
  console.log(chalk.gray(`Total configured rewards: ${rewardIds.length}\n`));
  
  // Show which rewards are actually configured
  if (rewardIds.length > 0) {
    console.log(chalk.gray("Configured reward IDs:"));
    for (const id of rewardIds) {
      const rewardInfo = await contract.getRewardInfo(id);
      console.log(chalk.gray(`  - ${rewardInfo.name} (${id.slice(0, 10)}...)`));
    }
    console.log();
  }

  const REWARD_IDS = getRewardIds();
  
  // Display recurring rewards first
  console.log(chalk.green.bold("Recurring Rewards:"));
  for (const [name, id] of Object.entries(REWARD_IDS)) {
    if (name.startsWith("TUTORIAL")) continue;
    
    try {
      const rewardInfo = await contract.getRewardInfo(id);
      const rewardName = name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      
      console.log(chalk.cyan(`${rewardName}:`));
      console.log(chalk.gray(`  Name: ${rewardInfo.name}`));
      console.log(chalk.gray(`  Description: ${rewardInfo.description}`));
      console.log(chalk.gray(`  Base Amount: ${ethers.formatEther(rewardInfo.config.baseAmount)} TOTEM`));
      console.log(chalk.gray(`  Cooldown: ${formatDuration(rewardInfo.config.cooldownPeriod)}`));
      console.log(chalk.gray(`  Streak Window: ${formatDuration(rewardInfo.config.streakWindow)}`));
      console.log(chalk.gray(`  Streak Bonus: ${rewardInfo.config.streakBonus?.toString() || '0'}% per streak`));
      console.log(chalk.gray(`  Max Bonus: ${rewardInfo.config.maxBonus?.toString() || '0'}%`));
      console.log();
    } catch (error: any) {
      console.log(chalk.red(`  Failed to fetch info for ${name}`));
      console.log(chalk.gray(`    Reason: ${error.reason || error.message || 'Unknown error'}`));
    }
  }
  
  // Display one-time rewards
  console.log(chalk.green.bold("One-Time Rewards:"));
  for (const [name, id] of Object.entries(REWARD_IDS)) {
    if (!name.startsWith("TUTORIAL")) continue;
    
    try {
      const rewardInfo = await contract.getOneTimeReward(id);
      const rewardName = name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
      
      console.log(chalk.cyan(`${rewardName}:`));
      console.log(chalk.gray(`  Name: ${rewardInfo.name}`));
      console.log(chalk.gray(`  Description: ${rewardInfo.description}`));
      console.log(chalk.gray(`  Token Reward: ${ethers.formatEther(rewardInfo.tokenReward)} TOTEM`));
      console.log(chalk.gray(`  Experience Reward: ${rewardInfo.experienceReward.toString()}`));
      console.log();
    } catch (error: any) {
      console.log(chalk.red(`  Failed to fetch info for ${name}`));
      console.log(chalk.gray(`    Reason: ${error.reason || error.message || 'Unknown error'}`));
    }
  }
}

async function displayUserStats(contract: TotemRewards, userAddress: string) {
  console.log(chalk.yellow.bold(`Stats for user: ${userAddress}\n`));

  const REWARD_IDS = getRewardIds();
  
  // Display recurring rewards stats
  console.log(chalk.green.bold("Recurring Rewards:"));
  for (const [name, id] of Object.entries(REWARD_IDS)) {
    if (name.startsWith("TUTORIAL")) continue;
    
    const rewardName = name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    console.log(chalk.cyan(`${rewardName}:`));

    try {
      const rewardInfo = await contract.getRewardInfo(id);
      const streakStatus = await contract.getStreakStatus(id, userAddress);
      const userInfo = await contract.getUserInfo(id, userAddress);
      const timeUntilClaim = await contract.getTimeUntilClaim(id, userAddress);
      
      console.log(chalk.gray(`  Current Streak: ${chalk.bold(streakStatus.currentStreak.toString())} days`));
      console.log(chalk.gray(`  Best Streak: ${chalk.bold(streakStatus.bestStreak.toString())} days`));
      console.log(chalk.gray(`  Total Claims: ${chalk.bold(userInfo.totalClaims.toString())}`));
      
      if (streakStatus.canClaim) {
        console.log(chalk.green(`  Status: Ready to claim! ✓`));
      } else {
        console.log(chalk.yellow(`  Next claim in: ${formatDuration(timeUntilClaim)}`));
      }
      
      if (streakStatus.isProtected) {
        const protectionRemaining = streakStatus.protectionExpiry - BigInt(Math.floor(Date.now() / 1000));
        console.log(chalk.magenta(`  Streak Protected: ${formatDuration(protectionRemaining)} remaining`));
      }
      
      if (userInfo.lastClaim > 0n) {
        const lastClaimDate = new Date(Number(userInfo.lastClaim) * 1000);
        console.log(chalk.gray(`  Last Claim: ${lastClaimDate.toLocaleString()}`));
      }
      
      if (rewardInfo.config.streakBonus && rewardInfo.config.maxBonus) {
        const currentBonus = Math.min(
          Number(streakStatus.currentStreak * rewardInfo.config.streakBonus),
          Number(rewardInfo.config.maxBonus)
        );
        if (currentBonus > 0) {
          console.log(chalk.green(`  Current Bonus: +${currentBonus}%`));
        }
      }
    } catch (error: any) {
      console.log(chalk.red(`  Failed to fetch user info: ${error.reason || error.message || 'Unknown error'}`));
    }
    console.log();
  }
  
  // Display one-time rewards stats
  console.log(chalk.green.bold("One-Time Rewards:"));
  for (const [name, id] of Object.entries(REWARD_IDS)) {
    if (!name.startsWith("TUTORIAL")) continue;
    
    const rewardName = name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    console.log(chalk.cyan(`${rewardName}:`));

    try {
      const hasClaimed = await contract.hasClaimedOneTimeReward(userAddress, id);
      const canClaim = await contract.canClaimOneTimeReward(userAddress, id);
      
      console.log(chalk.gray(`  Status: ${hasClaimed ? chalk.green("Claimed ✓") : canClaim ? chalk.yellow("Available") : chalk.red("Not Available")}`));
    } catch (error: any) {
      console.log(chalk.red(`  Failed to fetch user info: ${error.reason || error.message || 'Unknown error'}`));
    }
    console.log();
  }
}

function formatDuration(seconds: bigint | number): string {
  let totalSeconds: number;
  
  if (typeof seconds === 'bigint') {
    // Handle bigint conversion safely
    totalSeconds = Number(seconds);
  } else if (typeof seconds === 'object' && seconds !== null && 'toString' in seconds) {
    // Handle ethers BigNumber or similar objects
    totalSeconds = Number(seconds.toString());
  } else {
    totalSeconds = Number(seconds);
  }
  
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0 seconds';
  
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} minutes`;
  if (totalSeconds < 86400) return `${Math.floor(totalSeconds / 3600)} hours`;
  return `${Math.floor(totalSeconds / 86400)} days`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });