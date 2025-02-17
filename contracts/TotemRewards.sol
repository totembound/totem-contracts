// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ITotemAchievements } from "./interfaces/ITotemAchievements.sol";
import { TotemToken } from "./TotemToken.sol";

error InvalidAddress();
error InvalidBaseAmount();
error InvalidInterval();
error InvalidStreakBonus();
error InvalidMaxStreakBonus();
error InvalidForwarderAddress();
error InvalidMinStreak();
error InvalidGracePeriod();
error InvalidRewardId();
error RewardNotConfigured();
error RewardCurrentlyDisabled();
error ClaimingCurrentlyNotAllowed();
error InsufficientTokenBalance();
error TransferFailed();
error ProtectionAlreadyActive();
error ProtectionNotAvailable();
error InsufficientStreak();
error ProtectionDisabled();
error InvalidProtectionTier();
error InvalidDuration();
error InvalidCost();
error InvalidRequiredStreak();
error NoActiveProtection();
error InvalidMetadataKey();
error InvalidMetadataValue();

contract TotemRewards is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // Core structs for reward configuration
    struct RewardConfig {
        uint256 baseAmount;        // Base TOTEM reward amount
        uint256 interval;          // Time between claims (24h or 7d)
        uint256 streakBonus;       // Bonus % per consecutive claim
        uint256 maxStreakBonus;    // Maximum bonus %
        uint256 minStreak;         // Minimum streak required
        uint256 gracePeriod;       // Extra time allowed after interval
        bool allowProtection;      // Whether protection can be purchased
        bool enabled;              // Whether reward is active
        uint8 protectionTierCount; // Number of protection tiers
    }

    struct ProtectionTier {
        uint256 cost;              // TOTEM cost to purchase
        uint256 duration;          // How long protection lasts
        uint256 requiredStreak;    // Streak required to purchase
        bool enabled;              // Whether tier is active
    }

    struct RewardInfo {
        string name;               // Display name
        string description;        // User-friendly description
        string iconURI;            // IPFS URI for icon
        RewardConfig config;       // Core configuration
        mapping(uint8 => ProtectionTier) protectionTiers;
        mapping(string => string) metadata; // Custom attributes
    }

    struct StreakStatus {
        uint256 currentStreak;      // Current streak count
        uint256 bestStreak;         // Best streak achieved
        uint256 nextClaimTime;      // Timestamp when next claim is available
        uint256 gracePeriodEnd;     // When grace period ends
        bool canClaim;              // If user can claim now
        bool isProtected;           // If streak is currently protected
        uint256 protectionExpiry;   // When protection expires (if active)
    }

    struct UserTracking {
        uint256 lastClaim;          // Last claim timestamp
        uint256 currentStreak;      // Current streak count
        uint256 bestStreak;         // Highest achieved streak
        uint256 totalClaims;        // Total successful claims
        uint256 protectionExpiry;   // When protection expires
        uint8 activeTier;           // Active protection tier
    }

    // State variables
    TotemToken public totemToken;
    ITotemAchievements public achievements;
    address public trustedForwarder;
    
    // Mappings for reward tracking
    mapping(bytes32 => RewardInfo) private _rewardInfo;
    mapping(bytes32 => mapping(address => UserTracking)) private _userTracking;
    bytes32[] private _rewardIds;

    // Constants
    bytes32 private constant _LOGIN_ID = keccak256("daily_login");
    bytes32 private constant _LOGIN_ACHIEVEMENT_ID = keccak256("login_progression");

    // Events
    event RewardConfigured(bytes32 indexed rewardId, string name, RewardConfig config);
    event RewardClaimed(bytes32 indexed rewardId, address indexed user, uint256 amount, uint256 streak);
    event ProtectionPurchased(bytes32 indexed rewardId, address indexed user, uint8 tier, uint256 expiry);
    event ProtectionTierConfigured(bytes32 indexed rewardId, uint8 tier, ProtectionTier config);
    event ProtectionUsed(bytes32 indexed rewardId, address indexed user, uint8 tier);
    event MetadataSet(bytes32 indexed rewardId, string key, string value);
    event RewardEnabled(bytes32 indexed rewardId);
    event RewardDisabled(bytes32 indexed rewardId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _totemToken,
        address _trustedForwarder
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        if (_trustedForwarder == address(0)) revert InvalidForwarderAddress();
        totemToken = TotemToken(_totemToken);
        trustedForwarder = _trustedForwarder;
    }

    // Configuration functions
    function configureReward(
        bytes32 rewardId,
        string memory name,
        string memory description,
        string memory iconURI,
        RewardConfig memory config
    ) external onlyOwner {
        if (config.baseAmount == 0) revert InvalidBaseAmount();
        if (config.interval == 0) revert InvalidInterval();
        if (config.streakBonus > 100) revert InvalidStreakBonus();
        if (config.maxStreakBonus > 1000) revert InvalidMaxStreakBonus();
        if (config.gracePeriod >= config.interval) revert InvalidGracePeriod();

        RewardInfo storage reward = _rewardInfo[rewardId];
        reward.name = name;
        reward.description = description;
        reward.iconURI = iconURI;
        reward.config = config;

        // Add to tracked rewards if new
        bool isNewReward = true;
        for (uint256 i = 0; i < _rewardIds.length; i++) {
            if (_rewardIds[i] == rewardId) {
                isNewReward = false;
                break;
            }
        }
        if (isNewReward) {
            _rewardIds.push(rewardId);
        }

        emit RewardConfigured(rewardId, name, config);
    }

    function configureProtectionTier(
        bytes32 rewardId,
        uint8 tier,
        ProtectionTier memory config
    ) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (tier >= _rewardInfo[rewardId].config.protectionTierCount) 
            revert InvalidProtectionTier();
        if (config.duration == 0) revert InvalidDuration();
        if (config.cost == 0) revert InvalidCost();

        _rewardInfo[rewardId].protectionTiers[tier] = config;
        emit ProtectionTierConfigured(rewardId, tier, config);
    }

    // Claim functions
    function claim(bytes32 rewardId) external returns (uint256) {
        address user = _msgSender();
        RewardInfo storage reward = _rewardInfo[rewardId];
        UserTracking storage tracking = _userTracking[rewardId][user];

        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (!reward.config.enabled) revert RewardCurrentlyDisabled();
        if (!_canClaim(rewardId, user)) revert ClaimingCurrentlyNotAllowed();

        // Calculate reward amount with streak bonus
        uint256 amount = _calculateReward(reward.config, tracking.currentStreak);
        if (totemToken.balanceOf(address(this)) < amount) 
            revert InsufficientTokenBalance();

        // Update tracking
        _updateTracking(rewardId, user, tracking, reward.config);

        // Transfer reward
        if (!totemToken.transfer(user, amount)) revert TransferFailed();

        // Check for achievements
        if (address(achievements) != address(0)) {
            if (rewardId == _LOGIN_ID) {
                achievements.updateProgress(_LOGIN_ACHIEVEMENT_ID, user, 1);
            }
        }

        emit RewardClaimed(rewardId, user, amount, tracking.currentStreak);
        return amount;
    }

    // Protection functions
    function purchaseProtection(bytes32 rewardId, uint8 tier) external {
        address user = _msgSender();
        RewardInfo storage reward = _rewardInfo[rewardId];
        UserTracking storage tracking = _userTracking[rewardId][user];
        ProtectionTier memory protection = reward.protectionTiers[tier];

        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (!reward.config.allowProtection) revert ProtectionNotAvailable();
        if (!protection.enabled) revert ProtectionDisabled();
        if (tracking.currentStreak < protection.requiredStreak) 
            revert InsufficientStreak();
        if (tracking.protectionExpiry > block.timestamp) 
            revert ProtectionAlreadyActive();

        // Take payment
        if (!totemToken.transferFrom(user, address(this), protection.cost))
            revert TransferFailed();

        // Activate protection
        tracking.protectionExpiry = block.timestamp + protection.duration;
        tracking.activeTier = tier;

        emit ProtectionPurchased(rewardId, user, tier, tracking.protectionExpiry);
    }

    function setRewardMetadataAttribute(
        bytes32 rewardId,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        if (bytes(value).length == 0) revert InvalidMetadataValue();

        _rewardInfo[rewardId].metadata[key] = value;
        emit MetadataSet(rewardId, key, value);
    }

    function enableReward(bytes32 rewardId) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        _rewardInfo[rewardId].config.enabled = true;
        emit RewardEnabled(rewardId);
    }

    function disableReward(bytes32 rewardId) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        _rewardInfo[rewardId].config.enabled = false;
        emit RewardDisabled(rewardId);
    }

    function setAchievements(address _achievements) external onlyOwner {
        if (_achievements == address(0)) revert InvalidAddress();
        achievements = ITotemAchievements(_achievements);
    }

    function getMetadataAttribute(
        bytes32 rewardId,
        string calldata key
    ) external view returns (string memory) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        return _rewardInfo[rewardId].metadata[key];
    }

    function isClaimingAllowed(
        bytes32 rewardId,
        address user
    ) external view returns (bool) {
        if (!_rewardExists(rewardId)) return false;
        return _canClaim(rewardId, user);
    }

    function getRewardIds() external view returns (bytes32[] memory) {
        return _rewardIds;
    }

    function getRewardInfo(
        bytes32 rewardId
    ) external view returns (
        string memory name,
        string memory description,
        string memory iconURI,
        RewardConfig memory config
    ) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        RewardInfo storage reward = _rewardInfo[rewardId];
        return (reward.name, reward.description, reward.iconURI, reward.config);
    }

    // Get complete streak status for a user
    function getStreakStatus(
        bytes32 rewardId,
        address user
    ) external view returns (StreakStatus memory) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        
        RewardInfo storage reward = _rewardInfo[rewardId];
        UserTracking storage tracking = _userTracking[rewardId][user];
        
        (
            uint256 nextClaimTime,
            uint256 gracePeriodEnd,
            bool canClaim
        ) = _getNextClaimWindow(tracking, reward.config);
        
        bool isProtected = tracking.protectionExpiry >= block.timestamp;
        
        return StreakStatus({
            currentStreak: tracking.currentStreak,
            bestStreak: tracking.bestStreak,
            nextClaimTime: nextClaimTime,
            gracePeriodEnd: gracePeriodEnd,
            canClaim: canClaim,
            isProtected: isProtected,
            protectionExpiry: tracking.protectionExpiry
        });
    }

    // Get time until next claim is available (0 if can claim now)
    function getTimeUntilClaim(
        bytes32 rewardId,
        address user
    ) external view returns (uint256) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        
        UserTracking storage tracking = _userTracking[rewardId][user];
        
        // If first time claim or can claim now, return 0
        if (tracking.lastClaim == 0 || _canClaim(rewardId, user)) {
            return 0;
        }
        
        // Calculate next UTC midnight
        uint256 currentMidnight = _getUTCMidnight(block.timestamp);
        uint256 nextMidnight = currentMidnight + 1 days;
        
        // Return time until next midnight
        return nextMidnight - block.timestamp;
    }

    // Get protection status for a specific tier
    function getProtectionStatus(
        bytes32 rewardId,
        address user,
        uint8 tier
    ) external view returns (
        bool canPurchase,
        bool isActive,
        uint256 remainingTime
    ) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        
        RewardInfo storage reward = _rewardInfo[rewardId];
        UserTracking storage tracking = _userTracking[rewardId][user];
        ProtectionTier memory protection = reward.protectionTiers[tier];
        
        bool currentlyActive = tracking.protectionExpiry >= block.timestamp && 
                            tracking.activeTier == tier;
        
        bool eligibleToPurchase = protection.enabled &&
                                reward.config.allowProtection &&
                                tracking.currentStreak >= protection.requiredStreak &&
                                tracking.protectionExpiry < block.timestamp;
        
        uint256 timeRemaining = currentlyActive ? 
            tracking.protectionExpiry - block.timestamp : 0;
        
        return (eligibleToPurchase, currentlyActive, timeRemaining);
    }

    function getUserInfo(
        bytes32 rewardId,
        address user
    ) external view returns (UserTracking memory) {
        return _userTracking[rewardId][user];
    }

    function getProtectionTier(
        bytes32 rewardId,
        uint8 tier
    ) external view returns (ProtectionTier memory) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (tier >= _rewardInfo[rewardId].config.protectionTierCount)
            revert InvalidProtectionTier();
        return _rewardInfo[rewardId].protectionTiers[tier];
    }

    // Internal helper functions
     function _updateTracking(
        bytes32 rewardId,
        address user,
        UserTracking storage tracking,
        RewardConfig memory config
    ) internal {
        uint256 lastClaimMidnight = _getUTCMidnight(tracking.lastClaim);
        uint256 currentMidnight = _getUTCMidnight(block.timestamp);
        
        // Check if streak continues (past midnight UTC)
        bool maintainStreak = currentMidnight > lastClaimMidnight && 
            block.timestamp <= currentMidnight + config.gracePeriod;
    
        // If past grace period but protected
        if (!maintainStreak && tracking.protectionExpiry >= block.timestamp) {
            maintainStreak = true;
            // Consume protection if used
            tracking.protectionExpiry = 0;
            emit ProtectionUsed(rewardId, user, tracking.activeTier);
        }

        if (maintainStreak) {
            tracking.currentStreak++;
            if (tracking.currentStreak > tracking.bestStreak) {
                tracking.bestStreak = tracking.currentStreak;
            }
        } else {
            tracking.currentStreak = 1;
        }

        tracking.lastClaim = block.timestamp;
        tracking.totalClaims++;
    }

    // Override required functions
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _canClaim(
        bytes32 rewardId,
        address user
    ) internal view returns (bool) {
        RewardInfo storage reward = _rewardInfo[rewardId];
        UserTracking storage tracking = _userTracking[rewardId][user];

        // First time claim is always allowed
        if (tracking.lastClaim == 0) {
            return true;
        }

        // Check minimum streak requirement
        if (tracking.currentStreak < reward.config.minStreak) {
            return false;
        }

        (, , bool canClaim) = _getNextClaimWindow(tracking, reward.config);

        return canClaim;
    }

    function _msgSender() internal view override returns (address sender) {
        if (msg.sender == trustedForwarder) {
            // Extract the original sender from the end of the calldata
            // solhint-disable-next-line
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
       }
       else {
            // Directly return msg.sender for non-forwarder calls
            sender = msg.sender;
        }
        return sender;
    }

    function _rewardExists(bytes32 rewardId) internal view returns (bool) {
        for (uint256 i = 0; i < _rewardIds.length; i++) {
            if (_rewardIds[i] == rewardId) {
                return true;
            }
        }
        return false;
    }

    function _getNextClaimWindow(
        UserTracking storage tracking,
        RewardConfig memory config
    ) internal view returns (
        uint256 nextClaimTime,
        uint256 gracePeriodEnd,
        bool canClaim
    ) {
        uint256 lastClaimMidnight = _getUTCMidnight(tracking.lastClaim);
        uint256 currentMidnight = _getUTCMidnight(block.timestamp);
        
        // First time claim
        if (tracking.lastClaim == 0) {
            return (
                block.timestamp,  // Can claim immediately
                block.timestamp + config.gracePeriod,
                true
            );
        }

        // Regular claim window
        if (currentMidnight > lastClaimMidnight) {
            // Can claim after midnight UTC
            nextClaimTime = currentMidnight;
            gracePeriodEnd = currentMidnight + config.gracePeriod;
            canClaim = (block.timestamp <= gracePeriodEnd) || 
                    (tracking.protectionExpiry >= block.timestamp);
        } else {
            // Already claimed today
            nextClaimTime = currentMidnight + 1 days;
            gracePeriodEnd = nextClaimTime + config.gracePeriod;
            canClaim = false;
        }

        return (nextClaimTime, gracePeriodEnd, canClaim);
    }

    function _msgData() internal view override returns (bytes calldata) {
        if (msg.sender == trustedForwarder) {
            // Remove the last 20 bytes (address) from the calldata
            return msg.data[:msg.data.length - 20];
        }
        else {
            return msg.data;
        }
    }

    // Helper function to get UTC midnight timestamp
    function _getUTCMidnight(uint256 timestamp) internal pure returns (uint256) {
        return (timestamp / 1 days) * 1 days;
    }

    function _calculateReward(
        RewardConfig memory config,
        uint256 streak
    ) internal pure returns (uint256) {
        if (streak == 0) return config.baseAmount;
        
        uint256 bonusPercent = streak * config.streakBonus;
        if (bonusPercent > config.maxStreakBonus) {
            bonusPercent = config.maxStreakBonus;
        }
        
        return config.baseAmount + (config.baseAmount * bonusPercent / 100);
    }
}