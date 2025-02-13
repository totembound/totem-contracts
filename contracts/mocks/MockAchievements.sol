// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockAchievements {
    mapping(bytes32 => mapping(address => bool)) public achievementProgress;
    mapping(bytes32 => mapping(address => bool)) public userAchievements;

    function updateProgress(bytes32 id, address user, uint256 value) external {
        achievementProgress[id][user] = true;
    }

    function updateEvolutionProgress(address user, uint256 stage) external {
        // Simple mock implementation
        achievementProgress[keccak256("evolution_progression")][user] = true;
    }

    function unlockAchievement(bytes32 id, address user) external {
        userAchievements[id][user] = true;
    }

    function wasProgressUpdated(bytes32 id, address user) external view returns (bool) {
        return achievementProgress[id][user];
    }

    function hasAchievement(bytes32 achievementId, address user) external view returns (bool) {
        return userAchievements[achievementId][user];
    }
}