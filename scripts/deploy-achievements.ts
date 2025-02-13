import { ethers } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemAchievements } from "../typechain-types";
const ONETIME_REQUIREMENT = ethers.MaxUint256;

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
        Action=3,         // Game action based
        Challenge=4,      // Challenge completion based
        Expedition=5      // Expedition completion based
    }

    enum AchievementType {
        OneTime=0,       // Single unlock with badge
        Progression=1    // Multiple milestones with badges
    }

    // Achievements for collection, rarity discoveries
    const collectionAchievements = [
        {
            id: "rare_collector",
            name: "Rare Collector",
            description: "Obtain your first Rare totem",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/rare",
            subType: ethers.id("rarity"),
            requirements: [],
            milestones: []
        },
        {
            id: "epic_collector",
            name: "Epic Collector",
            description: "Obtain your first Epic totem",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/epic",
            subType: ethers.id("rarity"),
            requirements: [],
            milestones: []
        },
        {
            id: "legendary_collector",
            name: "Legendary Collector",
            description: "Obtain your first Legendary totem",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/rarity/legendary",
            subType: ethers.id("rarity"),
            requirements: [],
            milestones: []
        },
        {
            id: "collector_progression",
            name: "Totem Collector",
            description: "Become a legendary collector of mystical totems",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/collector/progression",
            subType: ethers.id("totems"),
            requirements: [], // Base progression
            milestones: [ 
                {
                    name: "Chosen Keeper",
                    description: "Your journey begins with your first totem",
                    badgeUri: "ipfs://badge/collector/first",
                    requirement: 1
                },
                {
                    name: "Novice Curator",
                    description: "With three totems in your collection, you begin to sense the patterns and connections between their energies",
                    badgeUri: "ipfs://badge/collector/novice-curator",
                    requirement: 3
                },
                {
                    name: "Dedicated Keeper",
                    description: "Six totems now resonate within your vault, each one adding to your growing understanding of their mysteries",
                    badgeUri: "ipfs://badge/collector/dedicated-keeper",
                    requirement: 6
                },
                {
                    name: "Established Guardian",
                    description: "Your collection of twelve totems marks you as a serious guardian of these ancient artifacts",
                    badgeUri: "ipfs://badge/collector/established-guardian",
                    requirement: 12
                },
                {
                    requirement: 32,
                    name: "Master Curator",
                    description: "With 32 totems, your collection has become a beacon of knowledge, the binary nature of their power grows clearer",
                    badgeUri: "ipfs://badge/collector/master-curator"
                },
                {
                    requirement: 64,
                    name: "Arcane Librarian",
                    description: "64 totems - a collection that resonates with digital precision, your understanding of their interconnected powers deepens",
                    badgeUri: "ipfs://badge/collector/arcane-librarian"
                },
                {
                    requirement: 128,
                    name: "Ethereal Archivist",
                    description: "128 totems unite under your care, their combined energy forming complex patterns of power that few can comprehend",
                    badgeUri: "ipfs://badge/collector/ethereal-archivist"
                },
                {
                    requirement: 256,
                    name: "Legendary Sage",
                    description: "You've attained true mastery with 256 totems, your collection is now a living repository of ancient wisdom and digital might",
                    badgeUri: "ipfs://badge/collector/legendary-sage"
                }
            ]
        },
        {
            id: "species_mastery",
            name: "Totem Taxonomist",
            description: "Collect each unique species of totem, building a complete catalogue of their diverse forms",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/collection/totem-taxonomist",
            subType: ethers.id("species"),
            requirements: [],
            milestones: []
        },
        {
            id: "affinity_specialist",
            name: "Affinity Specialist",
            description: "Master collecting totems of a single affinity, unlocking deep understanding of their unique properties",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/collection/affinity-specialist",
            subType: ethers.id("affinity"),
            requirements: [],
            milestones: [
                {
                    requirement: 6,
                    name: "Affinity Student",
                    description: "6 totems of the same affinity show your focused interest",
                    badgeUri: "ipfs://badge/collection/affinity-student"
                },
                {
                    requirement: 12,
                    name: "Affinity Scholar",
                    description: "12 totems of one affinity mark you as a dedicated specialist",
                    badgeUri: "ipfs://badge/collection/affinity-scholar",
                },
                {
                    requirement: 24,
                    name: "Affinity Master",
                    description: "24 totems of the same affinity reveal the depths of your specialized knowledge",
                    badgeUri: "ipfs://badge/collection/affinity-master"
                }
            ],
        },
        {
            id: "affinity_diversity",
            name: "Affinity Harmonizer",
            description: "Collect rare totems from each affinity to unlock a deeper understanding",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/collection/essence-harmonizer",
            subType: ethers.id("affinity"),
            requirements: [{
                achievementId: ethers.id("rare_collector"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
            milestones: []
        },
        {
            id: "domain_specialist",
            name: "Domain Specialist",
            description: "Master collecting totems of a single domain, deepening your connection to their realm of origin",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/collection/domain-specialist",
            subType: ethers.id("domain"),
            requirements: [],
            milestones: [
                {
                    name: "Domain Adept",
                    description: "6 totems from one domain mark you as a dedicated student of their mystical origins",
                    badgeUri: "ipfs://badge/collection/domain-student",
                    requirement: 6
                },
                {
                    name: "Domain Expert",
                    description: "12 totems from one domain, you've become a true authority",
                    badgeUri: "ipfs://badge/collection/domain-scholar",
                    requirement: 12
                },
                {
                    name: "Domain Sovereign",
                    description: "24 totems from a single domain establish you as a legendary keeper of their realm",
                    badgeUri: "ipfs://badge/collection/domain-master",
                    requirement: 24
                }
            ]
        },
        {
            id: "domain_diversity",
            name: "Domain Wayfarer",
            description: "Collect rare totems from all mystical domains to unlock their elemental nature",
            category: AchievementCategory.Collection,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/collection/comain-wayfarer",
            subType: ethers.id("domain"),
            requirements: [{
                achievementId: ethers.id("rare_collector"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
            milestones: []
        },
        {
            id: "anti_meta_collector",
            name: "Underdog Collector",
            description: "Collect and maximize the underdogs, uncommon and rare totems",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/collection/underdog",
            subType: ethers.id("rarity"),
            requirements: [],
            milestones: [
                {
                    name: "Humble Ascendant",
                    description: "Evolve 3 common totems to maximum stage",
                    badgeUri: "ipfs://badge/collection/uncommon-champion",
                    requirement: 3
                },
                {
                    name: "Uncommon Champion",
                    description: "Evolve 3 uncommon totems to maximum stage",
                    badgeUri: "ipfs://badge/collection/uncommon-champion",
                    requirement: 3
                },
                {
                    name: "Rare Virtuoso",
                    description: "Evolve 3 rare totems to maximum stage",
                    badgeUri: "ipfs://badge/collection/rare-virtuoso",
                    requirement: 3
                }
            ]
        },
        {
            id: "seasonal_collector",
            name: "Seasonal Spirit Keeper",
            description: "Collect special edition totems during seasonal events, preserving the timeline of mystical discoveries",
            category: AchievementCategory.Collection,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/seasonal/collector",
            subType: ethers.id("seasonal"),
            requirements: [],
            milestones: [
                {
                    name: "Seasonal Debut",
                    description: "Your first seasonal totem marks the beginning of your temporal collection",
                    badgeUri: "ipfs://badge/seasonal/debut",
                    requirement: 1
                },
                {
                    name: "Seasonal Curator",
                    description: "Five seasonal totems show your dedication to preserving magical moments in time",
                    badgeUri: "ipfs://badge/seasonal/curator",
                    requirement: 5
                },
                {
                    name: "Seasonal Archiver",
                    description: "Ten seasonal totems make you a true chronicler of mystical celebrations",
                    badgeUri: "ipfs://badge/seasonal/archiver",
                    requirement: 10
                }
            ]
        }
    ];

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
            requirements: [{
                achievementId: ethers.id("rare_collector"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
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
            requirements: [{
                achievementId: ethers.id("epic_collector"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
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
            requirements: [{
                achievementId: ethers.id("legendary_collector"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
            milestones: []
        },
        {
            id: "evolution_progression",
            name: "Evolution Mastery",
            description: "Master the art of evolving your Totem through different stages",
            category: AchievementCategory.Evolution,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/evolution/progression",
            subType: ethers.id("evolution"),
            requirements: [], // Base progression achievement
            milestones: [
                {
                    name: "First Evolution",
                    description: "Evolve your first totem to stage 2",
                    badgeUri: "ipfs://badge/evolution/stage1",
                    requirement: 1
                },
                {
                    name: "Adept Evolution",
                    description: "Evolve a totem to stage 3",
                    badgeUri: "ipfs://badge/evolution/stage2",
                    requirement: 2
                },
                {
                    name: "Master Evolution",
                    description: "Evolve a totem to stage 4 - Unlocks Epic rarity",
                    badgeUri: "ipfs://badge/evolution/stage3",
                    requirement: 3
                },
                {
                    name: "Elder Evolution",
                    description: "Evolve a totem to stage 5 - Unlocks Legendary rarity",
                    badgeUri: "ipfs://badge/evolution/stage4",
                    requirement: 4
                }
            ]
        },
        {
            id: "prestige_progression",
            name: "Prestige Collective",
            description: "Accumulate prestige levels across your totems, showcasing your mastery of totem evolution and growth",
            category: AchievementCategory.Evolution,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/prestige/progression",
            subType: ethers.id("prestige"),
            requirements: [{
                achievementId: ethers.id("evolution_progression"),
                milestoneIndex: 3 // Stage 4
            }],
            milestones: [
                {
                    name: "Emerging Collective",
                    description: "Your first totem begins to transcend their elder stage",
                    badgeUri: "ipfs://badge/prestige/collective1",
                    requirement: 1
                },
                {
                    name: "Collective Wisdom",
                    description: "Your totems are gaining collective experience, showing the depth of your nurturing and training",
                    badgeUri: "ipfs://badge/prestige/collective3",
                    requirement: 3
                },
                {
                    name: "Legendary Guardians",
                    description: "Your totem collection begins to resonate with ancient knowledge, each totem contributing to a greater mystical understanding",
                    badgeUri: "ipfs://badge/prestige/collective5",
                    requirement: 5
                },
                {
                    name: "Ethereal Convergence",
                    description: "Your totems are evolving beyond individual limitations, creating a powerful collective consciousness",
                    badgeUri: "ipfs://badge/prestige/collective10",
                    requirement: 10
                },
                {
                    name: "Cosmic Resonance",
                    description: "Your totem collection has reached a level of prestige that few thought possible, weaving a tapestry of magical potential",
                    badgeUri: "ipfs://badge/prestige/collective25",
                    requirement: 25
                },
                {
                    name: "Realm Shapers",
                    description: "Your totems have collectively ascended to a plane of existence that challenges the very foundations of magical understanding",
                    badgeUri: "ipfs://badge/prestige/collective50",
                    requirement: 50
                },
                {
                    name: "Infinite Pantheon",
                    description: "A legendary achievement that represents the ultimate collective evolution of totems, transcending all known boundaries of magical potential",
                    badgeUri: "ipfs://badge/prestige/collective100",
                    requirement: 100
                }
            ]
        },
        {
            id: "color_collector_evolution",
            name: "Chromatic Mastery",
            description: "Evolve totems of all unique colors to Elder stage",
            category: AchievementCategory.Evolution,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/evolution/chromatic",
            subType: ethers.id("color"),
            requirements: [{
                achievementId: ethers.id("evolution_progression"),
                milestoneIndex: 3 // Stage 4
            }],
            milestones: []
        },
        {
            id: "mixed_affinity_evolution",
            name: "Balanced Spirit Keeper",
            description: "Evolve totems with different affinities to their maximum potential",
            category: AchievementCategory.Evolution,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/evolution/balanced",
            subType: ethers.id("affinity"),
            requirements: [],
            milestones: [
                {
                    name: "Dual Affinity Harmony",
                    description: "Evolve totems from 2 different affinities",
                    badgeUri: "ipfs://badge/evolution/dual-affinity",
                    requirement: 2
                },
                {
                    name: "Triforce of Spirits",
                    description: "Evolve totems from 3 different affinities",
                    badgeUri: "ipfs://badge/evolution/tri-affinity",
                    requirement: 3
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
            badgeUri: "ipfs://badge/streak/login/progression",
            subType: ethers.id("daily_login"),
            requirements: [], // Base streak achievement
            milestones: [
                {
                    name: "Week Warrior",
                    description: "Maintain a 7-day login streak",
                    badgeUri: "ipfs://badge/streak/login/week",
                    requirement: 7
                },
                {
                    name: "Monthly Master",
                    description: "Maintain a 30-day login streak",
                    badgeUri: "ipfs://badge/streak/login/month",
                    requirement: 30
                },
                {
                    name: "Seasonal Spirit",
                    description: "Maintain a 90-day login streak",
                    badgeUri: "ipfs://badge/streak/login/quarter",
                    requirement: 90
                },
                {
                    name: "Seasonal Guardian",
                    description: "Maintain a 180-day (6-month) login streak",
                    badgeUri: "ipfs://badge/streak/login/half-year",
                    requirement: 180
                },
                {
                    name: "Eternal Spirit Keeper",
                    description: "Maintain a 365-day (1-year) login streak",
                    badgeUri: "ipfs://badge/streak/login/full-year",
                    requirement: 365
                }
            ]
        },
        {
            id: "persistence_reward",
            name: "Timeless Keeper",
            description: "Demonstrate long-term commitment to your totems",
            category: AchievementCategory.Streak,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/persistence/keeper",
            subType: ethers.id("long_term_engagement"),
            requirements: [],
            milestones: [
                {
                    name: "First Moon",
                    description: "Consistent caretaker for 30 days",
                    badgeUri: "ipfs://badge/persistence/first-moon",
                    requirement: 30
                },
                {
                    name: "Cycle Master",
                    description: "Consistent caretaker for 90 days",
                    badgeUri: "ipfs://badge/persistence/cycle-master",
                    requirement: 90
                },
                {
                    name: "Eternal Spirit",
                    description: "Demonstrate unwavering commitment for a full year",
                    badgeUri: "ipfs://badge/persistence/eternal-spirit",
                    requirement: 365
                }
            ]
        },
        {
            id: "referral_master",
            name: "Totem Recruiter",
            description: "Bring new spirit keepers into the TotemBound world",
            category: AchievementCategory.Streak,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/community/recruiter",
            subType: ethers.id("referral"),
            requirements: [],
            milestones: [
                {
                    name: "First Companion",
                    description: "Refer your first friend",
                    badgeUri: "ipfs://badge/community/first-referral",
                    requirement: 1
                },
                {
                    name: "Totem Spreader",
                    description: "Refer 5 friends who join the game",
                    badgeUri: "ipfs://badge/community/totem-spreader",
                    requirement: 5
                },
                {
                    name: "Spirit Network",
                    description: "Refer 25 friends who join the game",
                    badgeUri: "ipfs://badge/community/spirit-network",
                    requirement: 25
                }
            ]
        },
        {
            id: "community_ambassador",
            name: "Community Ambassador",
            description: "Engage with the TotemBound community and help others",
            category: AchievementCategory.Streak,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/community/ambassador",
            subType: ethers.id("social_engagement"),
            requirements: [],
            milestones: [
                {
                    name: "First Connection",
                    description: "Join the official Discord",
                    badgeUri: "ipfs://badge/community/first-connection",
                    requirement: 1
                },
                {
                    name: "Social Butterfly",
                    description: "Participate in 10 community events",
                    badgeUri: "ipfs://badge/community/social-butterfly",
                    requirement: 10
                },
                {
                    name: "Community Leader",
                    description: "Participate in 50 community events",
                    badgeUri: "ipfs://badge/community/leader",
                    requirement: 50
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
            badgeUri: "ipfs://badge/action/feed/progression",
            subType: ethers.id("feed_count"),
            requirements: [], // Base action achievement
            milestones: [
                {
                    name: "Caring Keeper",
                    description: "Feed your totem 100 times",
                    badgeUri: "ipfs://badge/action/feed/100",
                    requirement: 100,
                },
                {
                    name: "Diligent Caretaker",
                    description: "Feed your totem 500 times",
                    badgeUri: "ipfs://badge/action/feed/500",
                    requirement: 500,
                },
                {
                    name: "Devoted Guardian",
                    description: "Feed your totem 1,000 times",
                    badgeUri: "ipfs://badge/action/feed/1000",
                    requirement: 1000,
                },
                {
                    name: "Everlasting Nurturer",
                    description: "Feed your totem 5,000 times",
                    badgeUri: "ipfs://badge/action/feed/5000",
                    requirement: 5000,
                },
                {
                    name: "Eternal Provider",
                    description: "Feed your totem 10,000 times",
                    badgeUri: "ipfs://badge/action/feed/10000",
                    requirement: 10000,
                },
                {
                    name: "Cosmic Nurturer",
                    description: "Your dedication to feeding transcends mortal understanding",
                    badgeUri: "ipfs://badge/action/feed/cosmic-nurturer",
                    requirement: 25000
                },
                {
                    name: "Primordial Sustainer",
                    description: "You've become one with the life-giving essence of nourishment",
                    badgeUri: "ipfs://badge/action/feed/primordial-sustainer", 
                    requirement: 50000
                },
                {
                    name: "Omnipotent Nurturer",
                    description: "Your feeding prowess has become a fundamental force of creation itself",
                    badgeUri: "ipfs://badge/action/feed/omnipotent-nurturer",
                    requirement: 100000
                }
            ]
        },
        {
            id: "treat_progression",
            name: "Treating Mastery",
            description: "Master the art of treating your Totem",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/streak/action/treat/progression",
            subType: ethers.id("treat_count"),
            requirements: [], // Base action achievement
            milestones: [
                {
                    name: "Gentle Healer",
                    description: "Treat your totem 100 times",
                    badgeUri: "ipfs://badge/action/treat/100",
                    requirement: 100,
                },
                {
                    name: "Soothing Spirit",
                    description: "Treat your totem 500 times",
                    badgeUri: "ipfs://badge/action/treat/500",
                    requirement: 500,
                },
                {
                    name: "Compassionate Guardian",
                    description: "Treat your totem 1,000 times",
                    badgeUri: "ipfs://badge/action/treat/1000",
                    requirement: 1000,
                },
                {
                    name: "Blessed Medic",
                    description: "Treat your totem 5,000 times",
                    badgeUri: "ipfs://badge/action/treat/5000",
                    requirement: 5000,
                },
                {
                    name: "Divine Healer",
                    description: "Treat your totem 10,000 times",
                    badgeUri: "ipfs://badge/action/treat/10000",
                    requirement: 10000,
                },
                {
                    name: "Ethereal Healer",
                    description: "Your healing touch resonates with the deepest mystical energies",
                    badgeUri: "ipfs://badge/action/treat/ethereal-healer",
                    requirement: 25000
                },
                {
                    name: "Immortal Caretaker",
                    description: "Your compassion has become a force that defies the boundaries of existence",
                    badgeUri: "ipfs://badge/action/treat/immortal-caretaker",
                    requirement: 50000
                },
                {
                    name: "Eternal Mender",
                    description: "Your healing transcends time, space, and the very essence of existence",
                    badgeUri: "ipfs://badge/action/treat/eternal-mender",
                    requirement: 100000
                }
            ]
        },
        {
            id: "train_progression",
            name: "Training Mastery",
            description: "Master the art of training your Totem",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/action/train/progression",
            subType: ethers.id("train_count"),
            requirements: [], // Base action achievement
            milestones: [
                {
                    name: "Aspiring Trainer",
                    description: "Train your totem 100 times",
                    badgeUri: "ipfs://badge/action/train/100",
                    requirement: 100,
                },
                {
                    name: "Skilled Instructor",
                    description: "Train your totem 500 times",
                    badgeUri: "ipfs://badge/action/train/500",
                    requirement: 500,
                },
                {
                    name: "Master Mentor",
                    description: "Train your totem 1,000 times",
                    badgeUri: "ipfs://badge/action/train/1000",
                    requirement: 1000,
                },
                {
                    name: "Legendary Sensei",
                    description: "Train your totem 5,000 times",
                    badgeUri: "ipfs://badge/action/train/5000",
                    requirement: 5000,
                },
                {
                    name: "Totem Whisperer",
                    description: "Train your totem 10,000 times",
                    badgeUri: "ipfs://badge/action/train/10000",
                    requirement: 10000,
                },
                {
                    name: "Quantum Mentor",
                    description: "Your training techniques bend the very fabric of spiritual potential",
                    badgeUri: "ipfs://badge/action/train/quantum-mentor",
                    requirement: 25000
                },
                {
                    name: "Transcendent Sensei",
                    description: "You've unlocked the ultimate secrets of spiritual cultivation",
                    badgeUri: "ipfs://badge/action/train/transcendent-sensei",
                    requirement: 50000
                },
                {
                    name: "Reality Weaver",
                    description: "Your training has evolved beyond skill - you now reshape spiritual potential at will",
                    badgeUri: "ipfs://badge/action/train/reality-weaver",
                    requirement: 100000
                }
            ]
        },
        {
            id: "balanced_care",
            name: "Holistic Caretaker",
            description: "Maintain perfect balance in feeding, training, and treating",
            category: AchievementCategory.Action,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/action/balanced-care",
            subType: ethers.id("balanced_actions"),
            requirements: [],
            milestones: [
                {
                    name: "Mindful Keeper",
                    description: "You are learning the fundamentals of nurturing these mystical beings",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 10
                },
                {
                    name: "Harmony Initiator",
                    description: "Perform 50 balanced actions across feed, train, and treat",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 50
                },
                {
                    name: "Attentive Guardian",
                    description: "A hundred care actions demonstrate your growing dedication to the well-being of your totems",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 100
                },
                {
                    name: "Spirit Harmonizer",
                    description: "Perform 250 perfectly balanced actions",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 250
                },
                {
                    name: "Balanced Nurturer",
                    description: "Your consistent care creates harmony, 500 actions show your deep commitment to totem wellness",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 500
                },
                {
                    name: "Devoted Custodian",
                    description: "A thousand acts of care mark you as a true guardian, your totems thrive under your watchful guidance",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 1000
                },
                {
                    name: "Enlightened Caregiver",
                    description: "Your dedication transcends mere maintenance, each of your 2,500 actions flows with intuitive understanding",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 2500
                },
                {
                    name: "Mystic Cultivator",
                    description: "Five thousand care actions have attuned you to the deepest needs of your totems",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 5000
                },
                {
                    name: "Legendary Steward",
                    description: "Ten thousand acts of nurturing mark you as a true master of totem care",
                    badgeUri: "ipfs://badge/action/balanced-care/beginner",
                    requirement: 10000
                }
            ]
        }
    ];

    const challengeAchievements = [
        {
            id: "challenge_initiate",
            name: "Challenge Initiate",
            description: "Face your first challenge and begin your journey to greatness",
            category: AchievementCategory.Challenge,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/challenge/initiate",
            subType: ethers.id("challenge"),
            requirements: [],
            milestones: []
        },
        {
            id: "challenge_progression",
            name: "Challenge Master",
            description: "Master increasingly difficult challenges and prove your worth",
            category: AchievementCategory.Challenge,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/challenge/progression",
            subType: ethers.id("challenge"),
            requirements: [{
                achievementId: ethers.id("challenge_initiate"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
            milestones: [
                {
                    name: "Challenge Seeker",
                    description: "Complete 10 challenges",
                    badgeUri: "ipfs://badge/challenge/seeker",
                    requirement: 10
                },
                {
                    name: "Challenge Apprentice",
                    description: "Complete 100 challenges",
                    badgeUri: "ipfs://badge/challenge/apprentice",
                    requirement: 100
                },
                {
                    name: "Challenge Adept",
                    description: "Complete 1,000 challenges - your dedication to mastery begins to show",
                    badgeUri: "ipfs://badge/challenge/adept",
                    requirement: 1000
                },
                {
                    name: "Challenge Expert",
                    description: "Complete 5,000 challenges - your skill and strategy set you apart from the rest",
                    badgeUri: "ipfs://badge/challenge/expert",
                    requirement: 5000
                },
                {
                    name: "Challenge Master",
                    description: "Complete 10,000 challenges - others now look to you for guidance and inspiration",
                    badgeUri: "ipfs://badge.challenge/master",
                    requirement: 10000
                },
                {
                    name: "Challenge Grandmaster",
                    description: "Complete 50,000 challenges - your achievements inspire awe and admiration",
                    badgeUri: "ipfs://badge/challenge/grandmaster",
                    requirement: 50000
                },
                {
                    name: "Challenge Legend",
                    description: "Complete 100,000 challenges - your name will be forever etched in the annals of history",
                    badgeUri: "ipfs://badge/challenge/legend",
                    requirement: 100000
                }
            ]
        }
    ];
    
    const expeditionAchievements = [
        {
            id: "expedition_explorer",
            name: "Expedition Explorer",
            description: "Begin your journey as an expedition explorer",
            category: AchievementCategory.Expedition,
            type: AchievementType.OneTime,
            badgeUri: "ipfs://badge/expedition/explorer",
            subType: ethers.id("expedition"),
            requirements: [],
            milestones: []
        },
        {
            id: "expedition_progression",
            name: "Expedition Expert",
            description: "Venture forth on increasingly challenging expeditions",
            category: AchievementCategory.Expedition,
            type: AchievementType.Progression,
            badgeUri: "ipfs://badge/expedition/progression",
            subType: ethers.id("expedition"),
            requirements: [{
                achievementId: ethers.id("expedition_explorer"),
                milestoneIndex: ONETIME_REQUIREMENT
            }],
            milestones: [
                {
                    name: "Expedition Seeker",
                    description: "Complete 10 expeditions",
                    badgeUri: "ipfs://badge/expedition/seeker",
                    requirement: 10
                },
                {
                    name: "Expedition Scout",
                    description: "Complete 50 expeditions",
                    badgeUri: "ipfs://badge/expedition/scout",
                    requirement: 50
                },
                {
                    name: "Expedition Pathfinder",
                    description: "Complete 250 expeditions - master the basics of exploration",
                    badgeUri: "ipfs://badge/expedition/pathfinder",
                    requirement: 250
                },
                {
                    name: "Expedition Explorer",
                    description: "Complete 1,000 expeditions - forge new paths through unknown territories",
                    badgeUri: "ipfs://badge/expedition/explorer",
                    requirement: 1000
                },
                {
                    name: "Expedition Wayfarer",
                    description: "Complete 2,000 expeditions - traverse the most challenging terrains",
                    badgeUri: "ipfs://badge/expedition/wayfarer",
                    requirement: 2000
                },
                {
                    name: "Expedition Paragon",
                    description: "Complete 5,000 expeditions - achieve mastery of exploration",
                    badgeUri: "ipfs://badge/expedition/paragon",
                    requirement: 5000
                },
                {
                    name: "Expedition Legend",
                    description: "Complete 10,000 expeditions - you've mastered every path and discovered every secret",
                    badgeUri: "ipfs://badge/expedition/legend",
                    requirement: 10000
                }
            ]
        }
    ];

    const achievementConfigs = [
        ...collectionAchievements,
        ...evolutionAchievements,
        ...streakAchievements,
        ...actionAchievements,
        ...challengeAchievements,
        ...expeditionAchievements
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
            milestones: config.milestones,
            requirements: config.requirements || []
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
