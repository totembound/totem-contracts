import { ethers, network } from "hardhat";
import { loadDeployment } from "./helpers";
import { TotemChallenges } from "../typechain-types";

// Setup challenge types and attributes
enum ChallengeType {
    Trial,
    Arena
}

enum ChallengeAttribute {
    Balance,
    Strength,
    Agility,
    Wisdom
}

async function main() {
    const networkName = network.name;
    const deployment = loadDeployment(networkName);

    // Get TotemChallenges contract instance
    const challenges = await ethers.getContractAt(
        "TotemChallenges",
        deployment.challengesProxy
    ) as TotemChallenges;

    // Verify configuration
    console.log("\nVerifying challenge configuration...");
    const challengeIds = await challenges.getChallengeIds();
    console.log(`Found ${challengeIds.length} configured challenges:`);

    for (const id of challengeIds) {
        const info = await challenges.getChallengeInfo(id);
        console.log(`\nChallenge: ${info.name}`);
        console.log(`Description: ${info.description}`);
        console.log(`Type: ${ChallengeType[Number(info.challengeType)]}`);
        console.log(`Attribute: ${ChallengeAttribute[Number(info.attribute)]}`);
        console.log("Requirements:", {
            stage: info.requirements.stage,
            strength: info.requirements.strength,
            agility: info.requirements.agility,
            wisdom: info.requirements.wisdom
        });
        console.log(`Max Daily Attempts: ${info.maxDailyAttempts}`);
        console.log(`Max Score: ${info.maxScore}`);
        console.log(`Enabled: ${info.enabled}`);

        // Get metadata
        const category = await challenges.getChallengeMetadata(id, "category");
        const difficulty = await challenges.getChallengeMetadata(id, "difficulty");
        console.log("Metadata:", { category, difficulty });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });