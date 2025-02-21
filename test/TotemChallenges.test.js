const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { safeIncreaseTo } = require("./timeHelpers");

describe("TotemChallenges", function () {
    let TotemChallenges, TotemProxy;
    let challenges, proxy;
    let owner, addr1, addr2;

    // Test challenge configurations
    const strengthChallengeId = ethers.id("strength-challenge-1");
    const strengthAchievementId = ethers.id("strength_progression");

    const defaultChallenge = {
        name: "Boulder Breaker",
        description: "Break massive rocks by timing your strikes correctly",
        challengeType: 0, // Trial
        attribute: 0,     // Strength
        requirements: {
            stage: 2,
            strength: 10,
            agility: 5,
            wisdom: 5,
            domain: ethers.ZeroHash
        },
        maxDailyAttempts: 5,
        maxScore: 1000
    };

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // Deploy implementation
        TotemChallenges = await ethers.getContractFactory("TotemChallenges");
        const implementation = await TotemChallenges.deploy();

        // Deploy proxy
        const TotemProxy = await ethers.getContractFactory("TotemProxy");
        
        // Initialize proxy with implementation
        const initData = TotemChallenges.interface.encodeFunctionData("initialize");
        
        proxy = await TotemProxy.deploy(
            await implementation.getAddress(),
            owner.address,
            initData
        );

        // Get contract interface at proxy address
        challenges = await ethers.getContractAt("TotemChallenges", await proxy.getAddress());

        // Configure initial challenge
        await challenges.configureChallenge(
            strengthChallengeId,
            defaultChallenge.name,
            defaultChallenge.description,
            defaultChallenge.challengeType,
            defaultChallenge.attribute,
            defaultChallenge.requirements,
            defaultChallenge.maxDailyAttempts,
            defaultChallenge.maxScore,
            strengthAchievementId
        );
    });

    describe("Initialization", function () {
        it("Should initialize with correct parameters", async function () {
            expect(await challenges.owner()).to.equal(owner.address);
        });

        it("Should have challenge properly configured", async function () {
            const info = await challenges.getChallengeInfo(strengthChallengeId);
            expect(info.name).to.equal(defaultChallenge.name);
            expect(info.maxDailyAttempts).to.equal(defaultChallenge.maxDailyAttempts);
            expect(info.maxScore).to.equal(defaultChallenge.maxScore);
            expect(info.enabled).to.be.true;
        });
    });

    describe("Challenge Completion", function () {
        beforeEach(async function () {
            // Set to UTC midnight for consistent testing
            const currentTimestamp = await time.latest();
            const nextMidnight = Math.floor(currentTimestamp / 86400) * 86400 + 86400;
            await safeIncreaseTo(nextMidnight);
        });

        it("Should track attempts correctly", async function () {
            await challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,  // tokenId
                800  // score
            );

            const status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );

            expect(status.dailyAttempts).to.equal(1n);
            expect(status.attemptsRemaining).to.equal(4n);
            expect(status.highScore).to.equal(800n);
            expect(status.totalAttempts).to.equal(1n);
            expect(status.totalScore).to.equal(800n);
        });

        it("Should enforce daily attempt limits", async function () {
            // Complete 5 attempts
            for (let i = 0; i < 5; i++) {
                await challenges.connect(owner).completeChallenge(
                    strengthChallengeId,
                    addr1.address,
                    1n,
                    500
                );
            }

            // 6th attempt should fail
            await expect(challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                500
            )).to.be.revertedWithCustomError(challenges, "DailyChallengesExceeded");
        });

        it("Should validate score limits", async function () {
            await expect(challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                1200  // Above maxScore
            )).to.be.revertedWithCustomError(challenges, "InvalidScore");
        });

        it("Should track high scores correctly", async function () {
            // Complete with lower score
            await challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                500
            );

            // Complete with higher score
            await challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                800
            );

            const status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );

            expect(status.highScore).to.equal(800n);
            expect(status.totalScore).to.equal(1300n); // Sum of both attempts
        });
    });

    describe("UTC Midnight Transitions", function () {
        it("Should reset attempts at UTC midnight", async function () {
            // Get current timestamp and find next UTC midnight
            const currentTimestamp = await time.latest();
            const currentMidnight = Math.floor(currentTimestamp / 86400) * 86400;
            const nextMidnight = currentMidnight + 86400;

            // Move to current day and make attempts
            await safeIncreaseTo(currentMidnight + 3600); // 1 hour after midnight
            
            for (let i = 0; i < 3; i++) {
                await challenges.connect(owner).completeChallenge(
                    strengthChallengeId,
                    addr1.address,
                    1n,
                    500
                );
            }

            // Verify attempts before midnight
            let status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(3n);
            expect(status.attemptsRemaining).to.equal(2n);

            // Move past midnight
            await safeIncreaseTo(nextMidnight + 60); // 1 minute after midnight

            // Check attempts reset
            status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(0n);
            expect(status.attemptsRemaining).to.equal(5n);

            // Should be able to attempt again
            await challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                500
            );

            status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(1n);
            expect(status.totalAttempts).to.equal(4n); // Including previous day
        });

        it("Should maintain consistent state through midnight transition", async function () {
            // Get current time and align to a clean UTC midnight
            const currentTimestamp = await time.latest();
            const currentMidnight = Math.floor(currentTimestamp / 86400) * 86400;
            
            // Make initial attempts one hour after current midnight
            await safeIncreaseTo(currentMidnight + 3600); // Start at current day + 1 hour
            
            // Make 3 attempts
            for (let i = 0; i < 3; i++) {
                await challenges.connect(owner).completeChallenge(
                    strengthChallengeId,
                    addr1.address,
                    1n,
                    500
                );
            }

            // Verify state before moving forward
            let status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(3n);
            expect(status.attemptsRemaining).to.equal(2n);

            // Move to late in the same day
            await safeIncreaseTo(currentMidnight + 82800); // 23 hours into current day
            
            // Verify state hasn't changed
            status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(3n);
            expect(status.attemptsRemaining).to.equal(2n);

            // Move to next day
            await safeIncreaseTo(currentMidnight + 86400 + 3600); // Next day + 1 hour
            
            // Verify attempts have reset
            status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(0n);
            expect(status.attemptsRemaining).to.equal(5n);
            
            // Make a new attempt
            await challenges.connect(owner).completeChallenge(
                strengthChallengeId,
                addr1.address,
                1n,
                500
            );

            // Verify new day tracking is working
            status = await challenges.getUserChallengeStatus(
                strengthChallengeId,
                addr1.address
            );
            expect(status.dailyAttempts).to.equal(1n);
            expect(status.attemptsRemaining).to.equal(4n);
        });
    });

    describe("Admin Functions", function () {
        it("Should allow configuring new challenges", async function () {
            const newChallengeId = ethers.id("new-challenge");
            
            await challenges.configureChallenge(
                newChallengeId,
                "New Challenge",
                "Test Description",
                1, // Arena type
                2, // Wisdom attribute
                {
                    stage: 3,
                    strength: 15,
                    agility: 15,
                    wisdom: 15,
                    domain: ethers.id("air")
                },
                3, // maxDailyAttempts
                2000, // maxScore
                ethers.id("wisdom_progression")
            );

            const info = await challenges.getChallengeInfo(newChallengeId);
            expect(info.name).to.equal("New Challenge");
            expect(info.maxDailyAttempts).to.equal(3);
            expect(info.enabled).to.be.true;
        });

        it("Should allow setting challenge metadata", async function () {
            await challenges.setChallengeMetadata(
                strengthChallengeId,
                "difficulty",
                "medium"
            );

            const value = await challenges.getChallengeMetadata(
                strengthChallengeId,
                "difficulty"
            );
            expect(value).to.equal("medium");
        });

        it("Should validate configuration parameters", async function () {
            const invalidChallengeId = ethers.id("invalid-challenge");
            
            // Should fail with invalid requirements
            await expect(challenges.configureChallenge(
                invalidChallengeId,
                "Invalid Challenge",
                "Test",
                0,
                0,
                {
                    stage: 0, // Invalid: stage is 0
                    strength: 0,
                    agility: 0,
                    wisdom: 0,
                    domain: ethers.ZeroHash
                },
                5,
                1000,
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(challenges, "InvalidRequirements");

            // Should fail with invalid attempts/score
            await expect(challenges.configureChallenge(
                invalidChallengeId,
                "Invalid Challenge",
                "Test",
                0,
                0,
                defaultChallenge.requirements,
                0, // Invalid: maxDailyAttempts is 0
                1000,
                ethers.ZeroHash
            )).to.be.revertedWithCustomError(challenges, "InvalidChallengeConfig");
        });
    });
});
