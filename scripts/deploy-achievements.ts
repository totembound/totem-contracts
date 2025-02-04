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

    enum AchievementCategory {
        Evolution=0,      // Stage based
        Collection=1,     // NFT ownership based
        Streak=2,         // Time consistency based
        Action=3          // Game action based
    }

    enum AchievementType {
        OneTime=0,       // Single unlock with badge
        Progression=1    // Multiple milestones with badges
    }

    // Initialize default achievements
    const evolutionAchievements = [
        {
            id: "rare_evolution",
            name: "Rare Elder Evolution",
            description: "Evolve a Rare totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/rare",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "epic_evolution",
            name: "Epic Elder Evolution",
            description: "Evolve an Epic totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/epic",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "legendary_evolution",
            name: "Legendary Elder Evolution",
            description: "Evolve a Legendary totem to Elder",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/legendary",
            subType: ethers.id("rarity_evolution"),
            milestones: []
        },
        {
            id: "evolution_progression",
            name: "Evolution Mastery",
            description: "Master the art of evolving your Totem through different stages",
            category: AchievementCategory.Evolution,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("evolution"),
            milestones: [
                {
                    name: "First Evolution",
                    description: "Evolve your first totem to stage 1",
                    badgeUri: "ipfs://badge/evolution/stage1",
                    requirement: 1
                },
                {
                    name: "Adept Evolution",
                    description: "Evolve a totem to stage 2",
                    badgeUri: "ipfs://badge/evolution/stage2",
                    requirement: 2
                },
                {
                    name: "Master Evolution",
                    description: "Evolve a totem to stage 3 - Unlocks Epic rarity",
                    badgeUri: "ipfs://badge/evolution/stage3",
                    requirement: 3
                },
                {
                    name: "Elder Evolution",
                    description: "Evolve a totem to stage 4 - Unlocks Legendary rarity",
                    badgeUri: "ipfs://badge/evolution/stage4",
                    requirement: 4
                }
            ]
        }
    ];

    // One-time achievements for collection, rarity discoveries
    const collectionAchievements = [
        {
            id: "rare_collector",
            name: "Rare Collector",
            description: "Obtain your first Rare totem.",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/rare",
            subType: ethers.id("rarity"),
            milestones: []
        },
        {
            id: "epic_collector",
            name: "Epic Collector",
            description: "Obtain your first Epic totem.",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/epic",
            subType: ethers.id("rarity"),
            milestones: []
        },
        {
            id: "legendary_collector",
            name: "Legendary Collector",
            description: "Obtain your first Legendary totem.",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/legendary",
            subType: ethers.id("rarity"),
            milestones: []
        },
        {
            id: "collector_progression",
            name: "Totem Collector",
            description: "Become a legendary collector of mystical totems.",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("totems"),
            milestones: [ 
                {
                    name: "Chosen Keeper",
                    description: "Obtain your very first totem.",
                    badgeUri: "ipfs://badge/collector/first",
                    requirement: 1
                },
                {
                    name: "Totem Gatherer",
                    description: "Collect at least 3 totems.",
                    badgeUri: "ipfs://badge/collector/gatherer",
                    requirement: 3
                },
                {
                    name: "Totem Archivist",
                    description: "Expand your collection to 6 totems.",
                    badgeUri: "ipfs://badge/collector/archivist",
                    requirement: 6
                },
                {
                    name: "Grand Totemist",
                    description: "Reach a collection of 12 or more totems.",
                    badgeUri: "ipfs://badge/collector/grand",
                    requirement: 12
                }
            ]
        }
    ];

    const streakAchievements = [
        {
            id: "login_progression",
            name: "Daily Devotion",
            description: "Log in daily to keep your streak alive!",
            category: AchievementCategory.Streak,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("daily_login"),
            milestones: [
                {
                    name: "Week Warrior",
                    description: "Maintain a 7-day login streak",
                    badgeUri: "ipfs://streak/week",
                    requirement: 7
                },
                {
                    name: "Monthly Master",
                    description: "Maintain a 30-day login streak",
                    badgeUri: "ipfs://streak/month",
                    requirement: 30
                },
                {
                    name: "Seasonal Spirit",
                    description: "Maintain a 90-day login streak",
                    badgeUri: "ipfs://streak/quarter",
                    requirement: 90
                }
            ]
        }
    ];

    const actionAchievements = [
        {
            id: "feed_progression",
            name: "Feeding Mastery",
            description: "Master the art of feeding your Totem",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("feed_count"),
            milestones: [
                {
                    name: "Caring Keeper",
                    description: "Feed your totem 100 times",
                    badgeUri: "ipfs://action/feed/100",
                    requirement: 100,
                },
                {
                    name: "Diligent Caretaker",
                    description: "Feed your totem 500 times",
                    badgeUri: "ipfs://action/feed/500",
                    requirement: 500,
                },
                {
                    name: "Devoted Guardian",
                    description: "Feed your totem 1,000 times",
                    badgeUri: "ipfs://action/feed/1000",
                    requirement: 1000,
                },
                {
                    name: "Everlasting Nurturer",
                    description: "Feed your totem 5,000 times",
                    badgeUri: "ipfs://action/feed/5000",
                    requirement: 5000,
                },
                {
                    name: "Eternal Provider",
                    description: "Feed your totem 10,000 times",
                    badgeUri: "ipfs://action/feed/10000",
                    requirement: 10000,
                }
            ]
        },
        {
            id: "treat_progression",
            name: "Treating Mastery",
            description: "Master the art of treating your Totem",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("treat_count"),
            milestones: [
                {
                    name: "Gentle Healer",
                    description: "Treat your totem 100 times",
                    badgeUri: "ipfs://action/treat/100",
                    requirement: 100,
                },
                {
                    name: "Soothing Spirit",
                    description: "Treat your totem 500 times",
                    badgeUri: "ipfs://action/treat/500",
                    requirement: 500,
                },
                {
                    name: "Compassionate Guardian",
                    description: "Treat your totem 1,000 times",
                    badgeUri: "ipfs://action/treat/1000",
                    requirement: 1000,
                },
                {
                    name: "Blessed Medic",
                    description: "Treat your totem 5,000 times",
                    badgeUri: "ipfs://action/treat/5000",
                    requirement: 5000,
                },
                {
                    name: "Divine Healer",
                    description: "Treat your totem 10,000 times",
                    badgeUri: "ipfs://action/treat/10000",
                    requirement: 10000,
                }
            ]
        },
        {
            id: "train_progression",
            name: "Training Mastery",
            description: "Master the art of training your Totem",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "",
            subType: ethers.id("train_count"),
            milestones: [
                {
                    name: "Aspiring Trainer",
                    description: "Train your totem 100 times",
                    badgeUri: "ipfs://action/train/100",
                    requirement: 100,
                },
                {
                    name: "Skilled Instructor",
                    description: "Train your totem 500 times",
                    badgeUri: "ipfs://action/train/500",
                    requirement: 500,
                },
                {
                    name: "Master Mentor",
                    description: "Train your totem 1,000 times",
                    badgeUri: "ipfs://action/train/1000",
                    requirement: 1000,
                },
                {
                    name: "Legendary Sensei",
                    description: "Train your totem 5,000 times",
                    badgeUri: "ipfs://action/train/5000",
                    requirement: 5000,
                },
                {
                    name: "Totem Whisperer",
                    description: "Train your totem 10,000 times",
                    badgeUri: "ipfs://action/train/10000",
                    requirement: 10000,
                }
            ]
        }
    ];

    const achievementConfigs = [
        ...evolutionAchievements,
        ...collectionAchievements,
        ...streakAchievements,
        ...actionAchievements
    ];

    for (const config of achievementConfigs) {
        console.log(`Configuring achievement: ${config.id}`);
        const achievementConfig = {
            idString: config.id,
            name: config.name,
            description: config.description,
            category: config.category,
            achievementType: config.type,
            badgeUri: config.badgeUri,
            subType: config.subType,
            milestones: config.milestones
        };
    
        await achievements.configureAchievement(achievementConfig);
    }

    console.log("\nReward system deployment and configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
