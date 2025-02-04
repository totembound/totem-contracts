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
error NoMilestonesConfigured();

contract TotemAchievements is Initializable, OwnableUpgradeable, UUPSUpgradeable, ITotemAchievements {
    // State variables
    mapping(bytes32 => Achievement) private achievements;
    mapping(address => mapping(bytes32 => bool)) public userAchievements;
    mapping(address => mapping(bytes32 => AchievementProgress)) private userProgress;
    mapping(address => mapping(bytes32 => mapping(uint256 => bool))) private userMilestones;
    mapping(address => bool) public authorizedContracts;
    bytes32[] private achievementIds;

    // Events
    event AchievementConfigured(
        bytes32 indexed id, 
        string name, 
        AchievementCategory category,
        AchievementType achievementType,
        bytes32 subType
    );
    event AchievementUnlocked(bytes32 indexed id, address indexed user, string badgeUri);
    event AchievementEnabled(bytes32 indexed id);
    event AchievementDisabled(bytes32 indexed id);
    event MilestoneUnlocked(bytes32 indexed id, uint256 indexed milestone, address indexed user, string badgeUri);
    event ProgressUpdated(bytes32 indexed id, address indexed user, uint256 count);
    event MetadataSet(bytes32 indexed id, string key, string value);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _configureAchievement(AchievementConfig memory config) internal {
        bytes32 id = keccak256(bytes(config.idString));
        Achievement storage achievement = achievements[id];

        // Basic setup
        achievement.name = config.name;
        achievement.description = config.description;
        achievement.enabled = true;
        achievement.category = config.category;
        achievement.achievementType = config.achievementType;
        achievement.subType = config.subType;

        // Handle achievement type specific setup
        if (config.achievementType == AchievementType.OneTime) {
            achievement.badgeUri = config.badgeUri;
        }
        else {
            if (config.milestones.length == 0) revert NoMilestonesConfigured();
            delete achievement.milestones;
            _setMilestones(achievement, config.milestones);
        }
        
         _addToTrackedAchievements(id);

        emit AchievementConfigured(
            id,
            config.name,
            config.category,
            config.achievementType,
            config.subType
        );
    }

    function configureAchievement(AchievementConfig memory config) external onlyOwner {
        _configureAchievement(config);
    }

    function _setMilestones(Achievement storage achievement, Milestone[] memory milestones) internal {
        for (uint256 i = 0; i < milestones.length; i++) {
            achievement.milestones.push(milestones[i]);
        }
    }

    // Split out achievement tracking logic
    function _addToTrackedAchievements(bytes32 id) internal {
        for (uint i = 0; i < achievementIds.length; i++) {
            if (achievementIds[i] == id) return;
        }
        achievementIds.push(id);
    }

    // For direct unlocks (like evolution achievements)
    function unlockAchievement(bytes32 id, address user) external {
        if (!authorizedContracts[msg.sender]) revert UnauthorizedContract();


        Achievement storage achievement = achievements[id];
        if (!achievement.enabled) revert AchievementIsDisabled();
        if (achievement.achievementType != AchievementType.OneTime) 
            revert InvalidAchievementType();
        
        // If already achieved, silently return
        if (userAchievements[user][id]) return;

        // Get or initialize progress
        AchievementProgress storage progress = userProgress[user][id];
        if (progress.startTime == 0) {
            progress.startTime = block.timestamp;
        }
        
        // Mark as achieved
        progress.achieved = true;
        progress.lastUpdate = block.timestamp;
        userAchievements[user][id] = true;

        emit AchievementUnlocked(id, user, achievement.badgeUri);
    }

    // For progress-based achievements (like action counts)
    function updateProgress(bytes32 id, address user, uint256 value) external {
        if (!authorizedContracts[msg.sender]) revert UnauthorizedContract();
        if (!achievements[id].enabled) revert AchievementIsDisabled();
        
        Achievement storage achievement = achievements[id];
        if (achievement.achievementType != AchievementType.Progression)
            revert InvalidAchievementType();

        // Get or initialize progress
        AchievementProgress storage progress = userProgress[user][id];
        if (progress.startTime == 0) {
            progress.startTime = block.timestamp;
        }
        
        // add to count
        progress.count += value;
        progress.lastUpdate = block.timestamp;

        // Check milestones
        for (uint256 i = 0; i < achievement.milestones.length; i++) {
            if (progress.count >= achievement.milestones[i].requirement && 
                !userMilestones[user][id][i]) {
                userMilestones[user][id][i] = true;
                emit MilestoneUnlocked(
                    id, 
                    i, 
                    user, 
                    achievement.milestones[i].badgeUri
                );
            }
        }

        emit ProgressUpdated(id, user, value);
    }

    // View functions
    function getAchievementIds() external view returns (bytes32[] memory) {
        return achievementIds;
    }

    function getProgress(
        bytes32 achievementId, 
        address user
    ) external view returns (AchievementProgress memory) {
        return userProgress[user][achievementId];
    }

    function getAchievement(bytes32 id) external view returns (
        string memory name,
        string memory description,
        AchievementCategory category,
        AchievementType achievementType,
        string memory badgeUri,
        bytes32 subType,
        bool enabled,
        Milestone[] memory milestones
    ) {
        Achievement storage achievement = achievements[id];
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();

        return (
            achievement.name,
            achievement.description,
            achievement.category,
            achievement.achievementType,
            achievement.badgeUri,
            achievement.subType,
            achievement.enabled,
            achievement.milestones
        );
    }

    function getAchievementsByCategory(
        AchievementCategory category,
        address user
    ) external view returns (AchievementView[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < achievementIds.length; i++) {
            if (achievements[achievementIds[i]].category == category) {
                count++;
            }
        }

        AchievementView[] memory views = new AchievementView[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < achievementIds.length; i++) {
            bytes32 id = achievementIds[i];
            Achievement storage achievement = achievements[id];
            
            if (achievement.category == category) {
                AchievementProgress storage progress = userProgress[user][id];
                
                views[index] = AchievementView({
                    id: id,
                    name: achievement.name,
                    description: achievement.description,
                    achievementType: achievement.achievementType,
                    subType: achievement.subType,
                    enabled: achievement.enabled,
                    badgeUri: achievement.badgeUri,
                    milestones: achievement.milestones,
                    isCompleted: userAchievements[user][id],
                    currentCount: progress.count
                });
                index++;
            }
        }
        
        return views;
    }

    function getUserCategoriesProgress(
        address user
    ) external view returns (CategoryProgress[] memory) {
        CategoryProgress[] memory progress = new CategoryProgress[](4); // Assuming 4 categories
        
        for (uint256 cat = 0; cat < 4; cat++) {
            progress[cat].category = AchievementCategory(cat);
            
            for (uint256 i = 0; i < achievementIds.length; i++) {
                bytes32 id = achievementIds[i];
                Achievement storage achievement = achievements[id];
                
                if (achievement.category == AchievementCategory(cat)) {
                    progress[cat].totalAchievements++;
                    
                    if (achievement.achievementType == AchievementType.OneTime) {
                        if (userAchievements[user][id]) {
                            progress[cat].completedAchievements++;
                        }
                    }
                    else {
                        uint256 totalMilestones = achievement.milestones.length;
                        progress[cat].totalMilestones += totalMilestones;
                        
                        for (uint256 j = 0; j < totalMilestones; j++) {
                            if (userMilestones[user][id][j]) {
                                progress[cat].unlockedMilestones++;
                            }
                        }
                    }
                }
            }
        }
        
        return progress;
    }

    function getUserCompletedAchievements(
        address user
    ) external view returns (AchievementView[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < achievementIds.length; i++) {
            bytes32 id = achievementIds[i];
            if (userAchievements[user][id]) {
                count++;
            }
        }

        AchievementView[] memory completed = new AchievementView[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < achievementIds.length; i++) {
            bytes32 id = achievementIds[i];
            if (userAchievements[user][id]) {
                Achievement storage achievement = achievements[id];
                AchievementProgress storage progress = userProgress[user][id];
                
                completed[index] = AchievementView({
                    id: id,
                    name: achievement.name,
                    description: achievement.description,
                    achievementType: achievement.achievementType,
                    subType: achievement.subType,
                    enabled: achievement.enabled,
                    badgeUri: achievement.badgeUri,
                    milestones: achievement.milestones,
                    isCompleted: true,
                    currentCount: progress.count
                });
                index++;
            }
        }
        
        return completed;
    }

    function getAchievementProgress(
        bytes32 id,
        address user
    ) external view returns (
        bool isCompleted,
        uint256 currentCount,
        bool[] memory unlockedMilestones
    ) {
        Achievement storage achievement = achievements[id];
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();

        AchievementProgress storage progress = userProgress[user][id];
        
        if (achievement.achievementType == AchievementType.OneTime) {
            return (userAchievements[user][id], 0, new bool[](0));
        }
        else {
            bool[] memory milestoneStatus = new bool[](achievement.milestones.length);
            for (uint256 i = 0; i < achievement.milestones.length; i++) {
                milestoneStatus[i] = userMilestones[user][id][i];
            }
            return (false, progress.count, milestoneStatus);
        }
    }

    function getDetailedProgress(
        bytes32 id, 
        address user
    ) external view returns (DetailedProgress memory) {
        Achievement storage achievement = achievements[id];
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();

        AchievementProgress storage progress = userProgress[user][id];
        
        bool[] memory milestoneStatus;
        if (achievement.achievementType == AchievementType.Progression) {
            milestoneStatus = new bool[](achievement.milestones.length);
            for (uint256 i = 0; i < achievement.milestones.length; i++) {
                milestoneStatus[i] = userMilestones[user][id][i];
            }
        }
        else {
            milestoneStatus = new bool[](0);
        }

        return DetailedProgress({
            startTime: progress.startTime,
            lastUpdate: progress.lastUpdate,
            count: progress.count,
            achieved: userAchievements[user][id],
            unlockedMilestones: milestoneStatus
        });
    }

    function getMetadataAttribute(
        bytes32 id,
        string calldata key
    ) external view returns (string memory) {
        Achievement storage achievement = achievements[id];
        
        // Check if achievement exists by verifying if name is set
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();
        
        // Validate key
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        
        return achievement.metadata[key];
    }

    function hasAchievement(bytes32 achievementId, address user) external view returns (bool) {
        return userAchievements[user][achievementId];
    }

    // Admin functions
    function authorize(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = true;
    }

    function setMetadataAttribute(
        bytes32 id,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        Achievement storage achievement = achievements[id];
        
        // Check if achievement exists by verifying if name is set
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();
        
        // Validate inputs
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        if (bytes(value).length == 0) revert InvalidMetadataValue();

        // Set metadata and emit event
        achievement.metadata[key] = value;
        emit MetadataSet(id, key, value);
    }

    function enableAchievement(bytes32 id) external onlyOwner {
        Achievement storage achievement = achievements[id];
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();
        achievement.enabled = true;
        emit AchievementEnabled(id);
    }

    function disableAchievement(bytes32 id) external onlyOwner {
        Achievement storage achievement = achievements[id];
        if (bytes(achievement.name).length == 0) revert AchievementNotFound();
        achievement.enabled = false;
        emit AchievementDisabled(id);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
