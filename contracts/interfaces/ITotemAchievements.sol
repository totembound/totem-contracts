// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemAchievements {
    enum AchievementType {
        Evolution,      // Stage based
        Collection,     // NFT ownership based
        Streak,         // Time consistency based
        Action,         // Game action based
        Special         // Special events/time-based
    }

    struct Achievement {
        string name;
        string description;
        string iconUri;
        uint256 requirement;     // Numeric requirement
        AchievementType achievementType;
        bytes32 subType;        // e.g., "feed" for Action type
        bool enabled;
        mapping(string => string) metadata;  // For extensibility
    }

    struct AchievementProgress {
        uint256 count;          // For countable achievements
        uint256 startTime;      // For time-based tracking
        uint256 lastUpdate;     // For streak tracking
        bool achieved;
    }

    function unlockAchievement(
        bytes32 achievementId,
        address user,
        uint256 value
    ) external;

    function hasAchievement(
        bytes32 achievementId,
        address user
    ) external view returns (bool);

    function getProgress(
        bytes32 achievementId,
        address user
    ) external view returns (AchievementProgress memory);

    function updateProgress(
        bytes32 achievementId, 
        address user, 
        uint256 value
    ) external;
}
