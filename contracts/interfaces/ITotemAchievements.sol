// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemAchievements {
    enum AchievementCategory {
        Evolution,      // Stage based
        Collection,     // NFT ownership based
        Streak,         // Time consistency based
        Action,         // Game action based
        Challenge,      // Challenge completion based
        Expedition      // Expedition completion based
    }

    enum AchievementType {
        OneTime,       // Single unlock with badge
        Progression    // Multiple milestones with badges
    }

    struct Milestone {
        string name;
        string description;
        string badgeUri;
        uint256 requirement;
    }

    struct AchievementProgress {
        uint256 count;          // Current progress
        bool achieved;          // For OneTime: if unlocked
        uint256 startTime;      // When they started
        uint256 lastUpdate;     // Last update timestamp
    }

    struct Achievement {
        string name;
        string description;
        bool enabled;
        AchievementCategory category;
        AchievementType achievementType;
        bytes32 subType;        // e.g., "feed_count" for Action type
        string badgeUri;        // OneTime achievements use this
        Milestone[] milestones; // Progression achievements use these
        mapping(string => string) metadata;  // For extensibility
        bytes32[] requirements; // Achievement IDs required before this can be unlocked
    }

    struct AchievementConfig {
        string idString;
        string name;
        string description;
        AchievementCategory category;
        AchievementType achievementType;
        string badgeUri;
        bytes32 subType;
        Milestone[] milestones;
        bytes32[] requirements;
    }

    struct AchievementView {
        bytes32 id;
        string name;
        string description;
        AchievementCategory category;
        AchievementType achievementType;
        string badgeUri;
        bytes32 subType;
        bool enabled;
        Milestone[] milestones;
        bytes32[] requirements;
        bool isCompleted;
        uint256 currentCount;
    }

    struct CategoryProgress {
        AchievementCategory category;
        uint256 totalAchievements;
        uint256 completedAchievements;
        uint256 totalMilestones;
        uint256 unlockedMilestones;
    }

    struct DetailedProgress {
        uint256 startTime;
        uint256 lastUpdate;
        uint256 count;
        bool achieved;
        bool[] unlockedMilestones;
    }
    
    // Core functions
    function unlockAchievement(bytes32 id, address user) external;
    function updateProgress(bytes32 id, address user, uint256 value) external;
    function updateEvolutionProgress(address user, uint256 stage) external;

    // View functions
    function hasAchievement(bytes32 id, address user) external view returns (bool);
    function getAchievementIds() external view returns (bytes32[] memory);
    function getProgress(bytes32 achievementId, address user) external view returns (AchievementProgress memory);
    function getAchievement(bytes32 id) external view returns (
        string memory name,
        string memory description,
        AchievementCategory category,
        AchievementType achievementType,
        string memory badgeUri,
        bytes32 subType,
        bool enabled,
        Milestone[] memory milestones,
        bytes32[] memory requirements
    );
    function getAchievementsByCategory(AchievementCategory category) external view returns (
        AchievementView[] memory
    );
    function getUserCategoriesProgress(address user) external view returns (CategoryProgress[] memory);
    function getUserCompletedAchievements(address user) external view returns (AchievementView[] memory);
    function getAchievementProgress(bytes32 id, address user) external view returns (
        bool isCompleted,
        uint256 currentCount,
        bool[] memory unlockedMilestones
    );
    function getDetailedProgress(bytes32 id, address user) external view returns (DetailedProgress memory);
    function getMetadataAttribute(bytes32 id, string calldata key) external view returns (string memory);
}
