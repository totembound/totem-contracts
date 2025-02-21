// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ITotemAchievements } from "./interfaces/ITotemAchievements.sol";
import { ITotemChallenges } from "./interfaces/ITotemChallenges.sol";

// Errors
error ChallengeNotFound();
error ChallengeDisabled();
error InvalidScore();
error InvalidRequirements();
error InvalidAddress();
error InvalidChallengeConfig();
error DailyChallengesExceeded();

contract TotemChallenges is 
    ITotemChallenges,
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable 
{
    struct ChallengeConfig {
        string name;
        string description;
        bool enabled;
        ChallengeType challengeType;
        ChallengeAttribute attribute;
        Requirements requirements;
        uint256 maxDailyAttempts;
        uint256 maxScore;
        bytes32 achievementId;
        mapping(string => string) metadata;
    }

    struct UserChallengeTracking {
        uint256 lastAttemptTime;   // Last time challenge was attempted
        uint256 dailyAttempts;     // Current day's attempts
        uint256 highScore;         // Personal best
        uint256 totalAttempts;     // Lifetime attempts
        uint256 totalScore;        // Cumulative score
    }

    // State variables
    ITotemAchievements public achievements;
    mapping(bytes32 => ChallengeConfig) private _challenges;
    mapping(bytes32 => mapping(address => UserChallengeTracking)) private _userTracking;
    bytes32[] private _challengeIds;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    // Configuration functions
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
    ) external onlyOwner {
        if (maxDailyAttempts == 0 || maxScore == 0) 
            revert InvalidChallengeConfig();
        
        if (requirements.stage == 0 ||
            (requirements.strength == 0 && 
             requirements.agility == 0 && 
             requirements.wisdom == 0)) 
            revert InvalidRequirements();

        ChallengeConfig storage config = _challenges[challengeId];
        config.name = name;
        config.description = description;
        config.enabled = true;
        config.challengeType = challengeType;
        config.attribute = attribute;
        config.requirements = requirements;
        config.maxDailyAttempts = maxDailyAttempts;
        config.maxScore = maxScore;
        config.achievementId = achievementId;

        // Add to tracked challenges if new
        _addToTrackedChallenges(challengeId);

        emit ChallengeConfigured(challengeId, name, challengeType);
    }

    function setChallengeMetadata(
        bytes32 challengeId,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        if (!_challengeExists(challengeId)) revert ChallengeNotFound();
        _challenges[challengeId].metadata[key] = value;
        emit MetadataSet(challengeId, key, value);
    }

    function setAchievements(address _achievements) external onlyOwner {
        if (_achievements == address(0)) revert InvalidAddress();
        achievements = ITotemAchievements(_achievements);
    }

    // Core challenge functions
    function completeChallenge(
        bytes32 challengeId,
        address user,
        uint256 tokenId,
        uint256 score
    ) external onlyOwner {
        if (!_challengeExists(challengeId)) revert ChallengeNotFound();
        ChallengeConfig storage config = _challenges[challengeId];
        if (!config.enabled) revert ChallengeDisabled();

        UserChallengeTracking storage tracking = _userTracking[challengeId][user];
        
        // Get current UTC midnight
        uint256 currentMidnight = _getUTCMidnight(block.timestamp);
        
        // Initialize tracking if first attempt
        if (tracking.lastAttemptTime == 0) {
            tracking.dailyAttempts = 0;
        } else {
            // Check if it's a new day
            uint256 lastAttemptMidnight = _getUTCMidnight(tracking.lastAttemptTime);
            if (currentMidnight > lastAttemptMidnight) {
                tracking
                .dailyAttempts = 0;
            }
        }
        
        // Verify daily attempts
        if (tracking.dailyAttempts >= config.maxDailyAttempts)
            revert DailyChallengesExceeded();

        // Validate score
        if (score > config.maxScore) revert InvalidScore();
        
        // Update tracking
        tracking.lastAttemptTime = block.timestamp;
        tracking.dailyAttempts++;
        tracking.totalAttempts++;
        tracking.totalScore += score;
        
        // Update high score if applicable
        if (score > tracking.highScore) {
            tracking.highScore = score;
            emit HighScoreSet(challengeId, user, score);
        }

        // Update achievements if configured
        if (address(achievements) != address(0) && 
            config.achievementId != bytes32(0)) {
            achievements.updateProgress(config.achievementId, user, 1);
        }

        emit ChallengeCompleted(challengeId, user, tokenId, score);
    }

    // View functions
    function getChallengeIds() external view returns (bytes32[] memory) {
        return _challengeIds;
    }

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
    ) {
        if (!_challengeExists(challengeId)) revert ChallengeNotFound();
        ChallengeConfig storage config = _challenges[challengeId];
        
        return (
            config.name,
            config.description,
            config.challengeType,
            config.attribute,
            config.requirements,
            config.maxDailyAttempts,
            config.maxScore,
            config.enabled
        );
    }

    function getChallengeMetadata(
        bytes32 challengeId,
        string calldata key
    ) external view returns (string memory) {
        if (!_challengeExists(challengeId)) revert ChallengeNotFound();
        return _challenges[challengeId].metadata[key];
    }

    function getUserChallengeStatus(
        bytes32 challengeId,
        address user
    ) external view returns (
        uint256 dailyAttempts,
        uint256 attemptsRemaining,
        uint256 highScore,
        uint256 totalAttempts,
        uint256 totalScore
    ) {
        if (!_challengeExists(challengeId)) revert ChallengeNotFound();
        
        UserChallengeTracking storage tracking = _userTracking[challengeId][user];
        ChallengeConfig storage config = _challenges[challengeId];

        // If never attempted, return all zeros except maxAttempts remaining
        if (tracking.lastAttemptTime == 0) {
            return (
                0,                          // dailyAttempts
                config.maxDailyAttempts,    // attemptsRemaining
                0,                          // highScore
                0,                          // totalAttempts
                0                           // totalScore
            );
        }
        
        // Get current UTC midnight
        uint256 currentMidnight = _getUTCMidnight(block.timestamp);
        uint256 lastAttemptMidnight = _getUTCMidnight(tracking.lastAttemptTime);
        
        // If last attempt was before today's midnight, daily attempts is 0
        uint256 currentDayAttempts = currentMidnight > lastAttemptMidnight ? 0 : tracking.dailyAttempts;
        
        return (
            currentDayAttempts,
            config.maxDailyAttempts - currentDayAttempts,
            tracking.highScore,
            tracking.totalAttempts,
            tracking.totalScore
        );
    }
    
    function calculateExperienceGain(uint256 score, uint256 maxScore) external pure returns (uint256) {
        // Determine max XP based on challenge difficulty level
        uint256 maxXP;
        if (maxScore == 1000) {
            maxXP = 10;
        } else if (maxScore == 2000) {
            maxXP = 20;
        } else if (maxScore == 3000) {
            maxXP = 30;
        } else {
            maxXP = 10; // Default case
        }

        uint256 expGain = (score * maxXP) / maxScore;

        return expGain;
    }

    // Internal helpers
    function _addToTrackedChallenges(bytes32 id) internal {
        for (uint256 i = 0; i < _challengeIds.length; i++) {
            if (_challengeIds[i] == id) return;
        }
        _challengeIds.push(id);
    }

    function _challengeExists(bytes32 challengeId) internal view returns (bool) {
        ChallengeConfig storage config = _challenges[challengeId];
        bool exists = bytes(config.name).length > 0;
        return exists;
    }

    function _isNewDay(uint256 lastUsed) internal view returns (bool) {
        return (block.timestamp / 1 days) > (lastUsed / 1 days);
    }

    // Helper function for UTC midnight calculations
    function _getUTCMidnight(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / 1 days) * 1 days;
    }

    // Upgrade authorization
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // Events
    event ChallengeConfigured(bytes32 indexed id, string name, ChallengeType challengeType);
    event MetadataSet(bytes32 indexed id, string key, string value);
}