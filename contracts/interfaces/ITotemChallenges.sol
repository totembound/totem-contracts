// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemChallenges {
    enum ChallengeType {
        Trial,
        Arena
    }

    enum ChallengeAttribute {
        Strength,
        Agility,
        Wisdom
    }

    struct Requirements {
        uint256 stage;           // Minimum stage required
        uint256 strength;        // Min strength
        uint256 agility;         // Min agility
        uint256 wisdom;          // Min wisdom
        bytes32 domain;          // Required domain (for Arena)
    }

    event ChallengeCompleted(
        bytes32 indexed challengeId,
        address indexed user,
        uint256 tokenId,
        uint256 score
    );

    event HighScoreSet(
        bytes32 indexed id,
        address indexed user,
        uint256 score
    );

    function configureChallenge(
        bytes32 challengeId,
        string memory name,
        string memory description,
        ChallengeType challengeType,
        ChallengeAttribute attribute,
        Requirements memory requirements,
        uint256 maxDailyAttempts,
        uint256 maxScore,
        bytes32 achievementId
    ) external;

    function setChallengeMetadata(
        bytes32 challengeId,
        string calldata key,
        string calldata value
    ) external;

    function completeChallenge(
        bytes32 challengeId,
        address user,
        uint256 tokenId,
        uint256 score
    ) external;

    function getChallengeIds() external view returns (bytes32[] memory);

    function getChallengeInfo(
        bytes32 challengeId
    ) external view returns (
        string memory name,
        string memory description,
        ChallengeType challengeType,
        ChallengeAttribute attribute,
        Requirements memory requirements,
        uint256 maxDailyAttempts,
        uint256 maxScore,
        bool enabled
    );

    function getUserChallengeStatus(
        bytes32 challengeId,
        address user
    ) external view returns (
        uint256 dailyAttempts,
        uint256 attemptsRemaining,
        uint256 highScore,
        uint256 totalAttempts,
        uint256 totalScore
    );

    function calculateExperienceGain(
        uint256 score,
        uint256 maxScore
    ) external pure returns (uint256);
}