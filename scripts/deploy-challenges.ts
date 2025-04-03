import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemChallenges, TotemGame } from "../typechain-types";

async function main() {
    const networkName = network.name;
    const deployment = loadDeployment(networkName);
    const [deployer] = await ethers.getSigners();

    console.log("Configuring challenges with:", deployer.address);

    // Get TotemChallenges contract instance
    const challenges = await ethers.getContractAt(
        "TotemChallenges",
        deployment.challengesProxy
    ) as TotemChallenges;

    const game = await ethers.getContractAt(
        "TotemGame",
        deployment.gameProxy
    ) as TotemGame;

    // Setup challenge types and attributes
    enum ChallengeType {
        Trial,
        Arena
    }

    enum ChallengeAttribute {
        Strength,
        Agility,
        Wisdom
    }

    // Define achievement IDs (should match with achievements deployment)
    const strengthAchievementId = ethers.id("challenge_progression");
    const agilityAchievementId = ethers.id("challenge_progression");
    const wisdomAchievementId = ethers.id("challenge_progression");

    // Configure Strength Trials
    console.log("\nConfiguring Strength Trials...");
    const strengthTrials = [
        {
            id: ethers.id("strength-challenge-1"),
            name: "Boulder Breaker",
            description: "Break a massive rock by timing your strikes correctly. Strength determines power and speed. Harder levels add resistance.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Strength,
            requirements: {
                stage: 2,
                strength: 10,
                agility: 5,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 1000,
            achievementId: strengthAchievementId
        },
        {
            id: ethers.id("strength-challenge-2"),
            name: "Totem Wrestling",
            description: "Push against a guardian spirit in a strength duel. Tap rapidly to overpower it. Strength affects endurance and resistance.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Strength,
            requirements: {
                stage: 3,
                strength: 10,
                agility: 5,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 2000,
            achievementId: strengthAchievementId
        },
        {
            id: ethers.id("strength-challenge-3"),
            name: "Rockfall Defense",
            description: "Block falling boulders by clicking in the right zones. Strength increases stamina for longer survival. Higher levels add unpredictable patterns.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Strength,
            requirements: {
                stage: 4,
                strength: 10,
                agility: 5,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 3000,
            achievementId: strengthAchievementId
        }
    ];

    // Configure Agility Trials
    console.log("\nConfiguring Agility Trials...");
    const agilityTrials = [
        {
            id: ethers.id("agility-challenge-1"),
            name: "Spirit Path Navigation",
            description: "Navigate an obstacle course quickly. Agility affects speed and reaction time. Harder versions add moving obstacles.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Agility,
            requirements: {
                stage: 2,
                strength: 5,
                agility: 10,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 1000,
            achievementId: agilityAchievementId
        },
        {
            id: ethers.id("agility-challenge-2"),
            name: "Aerial Ring Dive",
            description: "Fly through shifting rings in the air. Agility improves control. Missing too many rings voids the attempt.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Agility,
            requirements: {
                stage: 3,
                strength: 5,
                agility: 10,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 2000,
            achievementId: agilityAchievementId
        },
        {
            id: ethers.id("agility-challenge-3"),
            name: "Totem Spirit Dance",
            description: "Tap in rhythm with spirit drum beats. Agility determines timing accuracy. Harder levels add offbeat sections.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Agility,
            requirements: {
                stage: 4,
                strength: 5,
                agility: 10,
                wisdom: 5,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 3000,
            achievementId: agilityAchievementId
        }
    ];

    // Configure Wisdom Trials
    console.log("\nConfiguring Wisdom Trials...");
    const wisdomTrials = [
        {
            id: ethers.id("wisdom-challenge-1"),
            name: "Ancient Runes Decoding",
            description: "Memorize and repeat glowing rune patterns. Wisdom increases memory retention and mistake tolerance. Higher levels add speed.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Wisdom,
            requirements: {
                stage: 2,
                strength: 5,
                agility: 5,
                wisdom: 10,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 1000,
            achievementId: wisdomAchievementId
        },
        {
            id: ethers.id("wisdom-challenge-2"),
            name: "Celestial Star Mapping",
            description: "Connect stars to form constellations. Wisdom provides hints and reduces errors. Higher difficulty means more complex patterns.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Wisdom,
            requirements: {
                stage: 3,
                strength: 5,
                agility: 5,
                wisdom: 10,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 2000,
            achievementId: wisdomAchievementId
        },
        {
            id: ethers.id("wisdom-challenge-3"),
            name: "Spirit Weaving Runes",
            description: "Align magical runes in the correct order. Incorrect placements disrupt the pattern. Wisdom slows instability.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Wisdom,
            requirements: {
                stage: 4,
                strength: 5,
                agility: 5,
                wisdom: 10,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 3000,
            achievementId: wisdomAchievementId
        }
    ];

    // Combine all trials
    const allTrials = [
        ...strengthTrials,
        ...agilityTrials,
        ...wisdomTrials
    ];

    // Configure challenges
    for (const trial of allTrials) {
        console.log(`\nConfiguring ${trial.name}...`);
        console.log("Challenge ID:", trial.id);
        console.log("Max Attempts:", trial.maxAttempts);
        console.log("Max Score:", trial.maxScore);
        console.log("Requirements:", JSON.stringify(trial.requirements));

        const tx = await game.configureChallenge(
            trial.id,
            trial.name,
            trial.description,
            trial.type,
            trial.attribute,
            trial.requirements,
            trial.maxAttempts,
            trial.maxScore,
            trial.achievementId
        );
        const receipt = await tx.wait();
        console.log("Transaction status:", receipt?.status);
        //console.log("Transaction logs:", receipt?.logs);

        // Add metadata for UI
        await (await game.setChallengeMetadata(
            trial.id,
            "category",
            trial.attribute === ChallengeAttribute.Strength ? "strength" :
            trial.attribute === ChallengeAttribute.Agility ? "agility" : "wisdom"
        )).wait();

        await (await game.setChallengeMetadata(
            trial.id,
            "difficulty",
            trial.requirements.stage.toString()
        )).wait();

        console.log(`${trial.name} configured with ID: ${trial.id}`);
    }

    console.log("\nChallenge system deployment and configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
