import { ethers } from "hardhat";
import { DeploymentContext, DeploymentPhase, DeploymentStep } from "../types/deployment";
import { withErrorHandling } from "../utils/error-handler";

export async function configureChallenges(context: DeploymentContext): Promise<void> {
  const { signer, state } = context;
  
  console.log("\n⚔️  Phase 8: Challenges Configuration");
  console.log("===================================");

  const getAddress = (contractName: string) => {
    const contract = state.deployedContracts[contractName];
    if (!contract) throw new Error(`Contract ${contractName} not found`);
    return contract.address;
  };

  await withErrorHandling(async () => {
    console.log("Loading game contract (challenges owned by game)...");
    const game = await ethers.getContractAt("TotemGame", getAddress("gameProxy"), signer);

    enum ChallengeType { Trial, Arena }
    enum ChallengeAttribute { Balance, Strength, Agility, Wisdom }

    // Define achievement IDs (should match with achievements deployment)
    const strengthAchievementId = ethers.id("challenge_progression");
    const agilityAchievementId = ethers.id("challenge_progression");
    const wisdomAchievementId = ethers.id("challenge_progression");
    const balanceAchievementId = ethers.id("challenge_progression");

    console.log("Configuring Strength Trials...");
    
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

    for (const trial of strengthTrials) {
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
      await tx.wait();
      console.log(`✅ Created challenge: ${trial.name}`);

      // Add metadata for UI (from original script)
      await (await game.setChallengeMetadata(trial.id, "category", "strength")).wait();
      await (await game.setChallengeMetadata(trial.id, "difficulty", trial.requirements.stage.toString())).wait();
      console.log(`Metadata set for ${trial.name}`);
    }

    console.log("Configuring Agility Trials...");
    
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

    for (const trial of agilityTrials) {
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
      await tx.wait();
      console.log(`✅ Created challenge: ${trial.name}`);

      // Add metadata for UI (from original script)
      await (await game.setChallengeMetadata(trial.id, "category", "agility")).wait();
      await (await game.setChallengeMetadata(trial.id, "difficulty", trial.requirements.stage.toString())).wait();
      console.log(`Metadata set for ${trial.name}`);
    }

    console.log("Configuring Wisdom Trials...");
    
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

    for (const trial of wisdomTrials) {
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
      await tx.wait();
      console.log(`✅ Created challenge: ${trial.name}`);

      // Add metadata for UI (from original script)
      await (await game.setChallengeMetadata(trial.id, "category", "wisdom")).wait();
      await (await game.setChallengeMetadata(trial.id, "difficulty", trial.requirements.stage.toString())).wait();
      console.log(`Metadata set for ${trial.name}`);
    }

    console.log("Configuring Balance Trial...");
    
    const balanceTrials = [
        {
            id: ethers.id("beginner-challenge-1"),
            name: "Garden Pest Control",
            description: "Start your totems journey by protecting the garden. Use your instinct and reflexes to smack down those pesky moles where they pop up.",
            type: ChallengeType.Trial,
            attribute: ChallengeAttribute.Balance,
            requirements: {
                stage: 1,
                strength: 1,
                agility: 1,
                wisdom: 1,
                domain: ethers.ZeroHash
            },
            maxAttempts: 5,
            maxScore: 1000,
            achievementId: balanceAchievementId
        }
    ];

    for (const trial of balanceTrials) {
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
      await tx.wait();
      console.log(`✅ Created challenge: ${trial.name}`);

      // Add metadata for UI (from original script)
      await (await game.setChallengeMetadata(trial.id, "category", "balance")).wait();
      await (await game.setChallengeMetadata(trial.id, "difficulty", trial.requirements.stage.toString())).wait();
      console.log(`Metadata set for ${trial.name}`);
    }

  }, context, context.errorHandler);

  state.phase = DeploymentPhase.EXPEDITIONS_CONFIG;
  console.log("\n✅ Phase 8 Complete: Challenges configured");
}

export function getChallengesConfigSteps(): DeploymentStep[] {
  return [
    { 
      id: "strength-trials", 
      name: "Configure Strength Trials (3)", 
      phase: DeploymentPhase.CHALLENGES_CONFIG,
      dependencies: ["challengesProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "agility-trials", 
      name: "Configure Agility Trials (3)", 
      phase: DeploymentPhase.CHALLENGES_CONFIG,
      dependencies: ["challengesProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "wisdom-trials", 
      name: "Configure Wisdom Trials (3)", 
      phase: DeploymentPhase.CHALLENGES_CONFIG,
      dependencies: ["challengesProxy"],
      optional: false,
      retryable: true
    },
    { 
      id: "balance-trials", 
      name: "Configure Balance Trials (1)", 
      phase: DeploymentPhase.CHALLENGES_CONFIG,
      dependencies: ["challengesProxy"],
      optional: false,
      retryable: true
    }
  ];
}