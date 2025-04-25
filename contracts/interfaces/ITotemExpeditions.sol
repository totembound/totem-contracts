// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemExpeditions {
    // Enums
    enum Domain {
        Land,
        Air, 
        Water
    }
    enum Affinity {
        Strength,
        Agility,
        Wisdom
    }

    // Events
    event ExpeditionConfigured(bytes32 indexed expeditionId, string name, Domain domain);
    event ExpeditionStarted(address indexed user, bytes32 indexed expeditionId, uint256[3] totemIds, uint256 endTime);
    event ExpeditionCompleted(address indexed user, bytes32 indexed expeditionId, uint256[3] totemIds);
    event ExpeditionRewardsClaimed(
        address indexed user,
        bytes32 indexed expeditionId,
        uint256 experienceGained,
        uint256[3] runeRewards,
        uint256 score
    );

    // Core functions
    function startExpedition(
        bytes32 expeditionId,
        uint256[3] memory totemIds
    ) external;
    
    function claimExpeditionRewards(bytes32 expeditionId) external;
    
    // View functions
    function isTotemOnExpedition(uint256 tokenId) external view returns (bool, uint256);
    
    function getExpeditions() external view returns (bytes32[] memory);
    
    function getExpeditionConfig(bytes32 expeditionId) external view returns (
        string memory name,
        uint8 domain,
        uint256 duration,
        uint256 totemCost,
        uint256 happinessCost,
        uint256 baseExperience,
        uint8[3] memory affinityWeights,
        uint8[3] memory runeDropChances,
        uint8 minStage,
        bool enabled
    );
    
    function getUserExpeditions(address user) external view returns (
        bytes32[] memory expeditionIds,
        uint256[][] memory totemIds,
        uint256[] memory endTimes,
        bool[] memory completed,
        bool[] memory canClaim
    );
    
    function getUserActiveExpeditions(address user) external view returns (
        bytes32[] memory expeditionIds,
        uint256[][] memory totemIds,
        uint256[] memory endTimes,
        bool[] memory canClaim
    );

    // Admin functions
    function configureExpedition(
        string memory idString,
        string memory name,
        uint8 domain,
        uint256 duration,
        uint256 totemCost,
        uint256 happinessCost,
        uint256 baseExperience,
        uint8[3] memory affinityWeights,
        uint8[3] memory runeDropChances,
        uint8 minStage
    ) external;
    
    function setAchievements(address _achievements) external;
    function setGame(address _game) external;
}
