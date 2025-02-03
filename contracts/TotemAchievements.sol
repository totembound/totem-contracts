// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/ITotemAchievements.sol";

error InvalidAchievementId();
error AchievementNotFound();
error InvalidMetadataKey();
error InvalidMetadataValue();
error InvalidRequirement();
error AchievementIsDisabled();
error RequirementNotMet();
error UnauthorizedContract();
error InvalidAchievementType();

contract TotemAchievements is Initializable, OwnableUpgradeable, UUPSUpgradeable, ITotemAchievements {

    struct AchievementView {
        string name;
        string description;
        string iconUri;
        uint256 requirement;
        AchievementType achievementType;
        bytes32 subType;        // e.g., "feed" for Action type
        bool enabled;
    }

    // State variables
    mapping(bytes32 => Achievement) private achievements;
    mapping(address => mapping(bytes32 => bool)) public userAchievements;
    mapping(address => mapping(bytes32 => AchievementProgress)) private userProgress;
    mapping(address => bool) public authorizedContracts;
    bytes32[] private achievementIds;

    // Events
    event AchievementConfigured(
        bytes32 indexed id, 
        string name, 
        uint256 requirement,
        AchievementType achievementType,
        bytes32 subType
    );
    event AchievementUnlocked(bytes32 indexed id, address indexed user);
    event AchievementEnabled(bytes32 indexed id);
    event AchievementDisabled(bytes32 indexed id);
    event MetadataSet(bytes32 indexed id, string key, string value);
    event ProgressUpdated(bytes32 indexed id, address indexed user, uint256 count);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _configureAchievement(
        string memory idString,
        string memory name,
        string memory description,
        string memory iconUri,
        uint256 requirement,
        AchievementType achievementType,
        bytes32 subType
    ) internal {
        bytes32 id = keccak256(bytes(idString));
        if (requirement == 0) revert InvalidRequirement();

        Achievement storage achievement = achievements[id];
        achievement.name = name;
        achievement.description = description;
        achievement.iconUri = iconUri;
        achievement.requirement = requirement;
         achievement.achievementType = achievementType;
        achievement.subType = subType;
        achievement.enabled = true;

        // Add to tracked achievements if new
        bool isNew = true;
        for (uint i = 0; i < achievementIds.length; i++) {
            if (achievementIds[i] == id) {
                isNew = false;
                break;
            }
        }
        if (isNew) {
            achievementIds.push(id);
        }

        emit AchievementConfigured(id, name, requirement, achievementType, subType);
    }

    function configureAchievement(
        string calldata idString,
        string calldata name,
        string calldata description,
        string calldata iconUri,
        uint256 requirement,
        AchievementType achievementType,
        bytes32 subType
    ) external onlyOwner {
        _configureAchievement(idString, name, description, iconUri, requirement, achievementType, subType);
    }

    // For direct unlocks (like evolution achievements)
    function unlockAchievement(bytes32 achievementId, address user, uint256 value) external {
        if (!authorizedContracts[msg.sender]) revert UnauthorizedContract();

        Achievement storage achievement = achievements[achievementId];
        if (achievement.requirement == 0) revert AchievementNotFound();
        if (!achievement.enabled) revert AchievementIsDisabled();
        if (value < achievement.requirement) revert RequirementNotMet();

        // Update progress
        AchievementProgress storage progress = userProgress[user][achievementId];
        progress.count = value;
        progress.lastUpdate = block.timestamp;
        progress.achieved = true;

        userAchievements[user][achievementId] = true;
        emit AchievementUnlocked(achievementId, user);
    }

    // For progress-based achievements (like action counts)
    function updateProgress(
        bytes32 achievementId, 
        address user, 
        uint256 value
    ) external {
        if (!authorizedContracts[msg.sender]) revert UnauthorizedContract();
        
        Achievement storage achievement = achievements[achievementId];
        if (achievement.requirement == 0) revert AchievementNotFound();
        if (!achievement.enabled) revert AchievementIsDisabled();

        AchievementProgress storage progress = userProgress[user][achievementId];
        progress.count = value;
        progress.lastUpdate = block.timestamp;

        if (value >= achievement.requirement && !progress.achieved) {
            progress.achieved = true;
            userAchievements[user][achievementId] = true;
            emit AchievementUnlocked(achievementId, user);
        }

        emit ProgressUpdated(achievementId, user, value);
    }

    function authorize(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = true;
    }

    function setMetadataAttribute(
        bytes32 achievementId,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        Achievement storage achievement = achievements[achievementId];
        if (achievement.requirement == 0) revert AchievementNotFound();
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        if (bytes(value).length == 0) revert InvalidMetadataValue();

        achievement.metadata[key] = value;
        emit MetadataSet(achievementId, key, value);
    }

    // View functions
    function getAchievementIds() external view returns (bytes32[] memory) {
        return achievementIds;
    }

    function getAchievement(bytes32 id) external view returns (AchievementView memory) {
        Achievement storage achievement = achievements[id];
        if (achievement.requirement == 0) revert AchievementNotFound();

        return AchievementView({
            name: achievement.name,
            description: achievement.description,
            iconUri: achievement.iconUri,
            requirement: achievement.requirement,
            achievementType: achievement.achievementType,
            subType: achievement.subType,
            enabled: achievement.enabled
        });
    }

    function getProgress(
        bytes32 achievementId, 
        address user
    ) external view returns (AchievementProgress memory) {
        return userProgress[user][achievementId];
    }

    function getMetadataAttribute(
        bytes32 achievementId,
        string calldata key
    ) external view returns (string memory) {
        Achievement storage achievement = achievements[achievementId];
        if (achievement.requirement == 0) revert AchievementNotFound();
        return achievement.metadata[key];
    }

    function hasAchievement(bytes32 achievementId, address user) external view returns (bool) {
        return userAchievements[user][achievementId];
    }

    function getHighestStageUnlocked(address user) external view returns (uint256) {
        uint256 highestStage = 0;
        for (uint i = 0; i < achievementIds.length; i++) {
            bytes32 id = achievementIds[i];
            if (userAchievements[user][id]) {
                Achievement storage achievement = achievements[id];
                if (achievement.requirement > highestStage) {
                    highestStage = achievement.requirement;
                }
            }
        }
        return highestStage;
    }

    // Admin functions
    function enableAchievement(bytes32 id) external onlyOwner {
        Achievement storage achievement = achievements[id];
        if (achievement.requirement == 0) revert AchievementNotFound();
        achievement.enabled = true;
        emit AchievementEnabled(id);
    }

    function disableAchievement(bytes32 id) external onlyOwner {
        Achievement storage achievement = achievements[id];
        if (achievement.requirement == 0) revert AchievementNotFound();
        achievement.enabled = false;
        emit AchievementDisabled(id);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
