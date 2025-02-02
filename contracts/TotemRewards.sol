// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./TotemToken.sol";

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
        uint256 cost;             // TOTEM cost to purchase
        uint256 duration;         // How long protection lasts
        uint256 requiredStreak;   // Streak required to purchase
        bool enabled;             // Whether tier is active
    }

    struct RewardInfo {
        string name;              // Display name
        string description;       // User-friendly description
        string iconURI;          // IPFS URI for icon
        RewardConfig config;     // Core configuration
        mapping(uint8 => ProtectionTier) protectionTiers;
        mapping(string => string) metadata; // Custom attributes
    }

    struct UserTracking {
        uint256 lastClaim;       // Last claim timestamp
        uint256 currentStreak;   // Current streak count
        uint256 bestStreak;      // Highest achieved streak
        uint256 totalClaims;     // Total successful claims
        uint256 protectionExpiry; // When protection expires
        uint8 activeTier;        // Active protection tier
    }

    // State variables
    TotemToken public totemToken;
    address public trustedForwarder;
    
    // Mappings for reward tracking
    mapping(bytes32 => RewardInfo) private rewardInfo;
    mapping(bytes32 => mapping(address => UserTracking)) private userTracking;
    bytes32[] private rewardIds;

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

        RewardInfo storage reward = rewardInfo[rewardId];
        reward.name = name;
        reward.description = description;
        reward.iconURI = iconURI;
        reward.config = config;

        // Add to tracked rewards if new
        bool isNewReward = true;
        for (uint i = 0; i < rewardIds.length; i++) {
            if (rewardIds[i] == rewardId) {
                isNewReward = false;
                break;
            }
        }
        if (isNewReward) {
            rewardIds.push(rewardId);
        }

        emit RewardConfigured(rewardId, name, config);
    }

    function configureProtectionTier(
        bytes32 rewardId,
        uint8 tier,
        ProtectionTier memory config
    ) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (tier >= rewardInfo[rewardId].config.protectionTierCount) 
            revert InvalidProtectionTier();
        if (config.duration == 0) revert InvalidDuration();
        if (config.cost == 0) revert InvalidCost();

        rewardInfo[rewardId].protectionTiers[tier] = config;
        emit ProtectionTierConfigured(rewardId, tier, config);
    }

    // Claim functions
    function claim(bytes32 rewardId) external returns (uint256) {
        address user = _msgSender();
        RewardInfo storage reward = rewardInfo[rewardId];
        UserTracking storage tracking = userTracking[rewardId][user];

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

        emit RewardClaimed(rewardId, user, amount, tracking.currentStreak);
        return amount;
    }

    // Protection functions
    function purchaseProtection(bytes32 rewardId, uint8 tier) external {
        address user = _msgSender();
        RewardInfo storage reward = rewardInfo[rewardId];
        UserTracking storage tracking = userTracking[rewardId][user];
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

    // Internal helper functions
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

    function _canClaim(
        bytes32 rewardId,
        address user
    ) internal view returns (bool) {
        RewardInfo storage reward = rewardInfo[rewardId];
        UserTracking storage tracking = userTracking[rewardId][user];

        // First time claim is always allowed
        if (tracking.lastClaim == 0) {
            return true;
        }

        // Check minimum streak requirement
        if (tracking.currentStreak < reward.config.minStreak) {
            return false;
        }

        uint256 nextClaimTime = tracking.lastClaim + reward.config.interval;
        
        // Not yet time for next claim
        if (block.timestamp < nextClaimTime) {
            return false;
        }
        
        // Within normal claim window
        if (block.timestamp <= nextClaimTime + reward.config.gracePeriod) {
            return true;
        }
        
        // If outside grace period but protected, allow claim
        if (tracking.protectionExpiry >= block.timestamp) {
            return true;
        }

        // If outside grace period and not protected, don't allow claim
        if (block.timestamp > nextClaimTime + reward.config.gracePeriod) {
            return false;
        }

        return true;
    }

     function _updateTracking(
        bytes32 rewardId,
        address user,
        UserTracking storage tracking,
        RewardConfig memory config
    ) internal {
        uint256 nextClaimTime = tracking.lastClaim + config.interval;
        
        // Check if streak continues
        bool maintainStreak = block.timestamp <= nextClaimTime + config.gracePeriod;
        
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

    function _rewardExists(bytes32 rewardId) internal view returns (bool) {
        for (uint i = 0; i < rewardIds.length; i++) {
            if (rewardIds[i] == rewardId) {
                return true;
            }
        }
        return false;
    }

    // View functions
    function isClaimingAllowed(
        bytes32 rewardId,
        address user
    ) external view returns (bool) {
        if (!_rewardExists(rewardId)) return false;
        return _canClaim(rewardId, user);
    }

    function getRewardIds() external view returns (bytes32[] memory) {
        return rewardIds;
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
        RewardInfo storage reward = rewardInfo[rewardId];
        return (reward.name, reward.description, reward.iconURI, reward.config);
    }

    function getUserInfo(
        bytes32 rewardId,
        address user
    ) external view returns (UserTracking memory) {
        return userTracking[rewardId][user];
    }

    function getProtectionTier(
        bytes32 rewardId,
        uint8 tier
    ) external view returns (ProtectionTier memory) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (tier >= rewardInfo[rewardId].config.protectionTierCount)
            revert InvalidProtectionTier();
        return rewardInfo[rewardId].protectionTiers[tier];
    }

    // Metadata functions
    function setRewardMetadataAttribute(
        bytes32 rewardId,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        if (bytes(key).length == 0) revert InvalidMetadataKey();
        if (bytes(value).length == 0) revert InvalidMetadataValue();

        rewardInfo[rewardId].metadata[key] = value;
        emit MetadataSet(rewardId, key, value);
    }

    function getMetadataAttribute(
        bytes32 rewardId,
        string calldata key
    ) external view returns (string memory) {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        return rewardInfo[rewardId].metadata[key];
    }

    // Admin functions
    function enableReward(bytes32 rewardId) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        rewardInfo[rewardId].config.enabled = true;
        emit RewardEnabled(rewardId);
    }

    function disableReward(bytes32 rewardId) external onlyOwner {
        if (!_rewardExists(rewardId)) revert RewardNotConfigured();
        rewardInfo[rewardId].config.enabled = false;
        emit RewardDisabled(rewardId);
    }

    // Override required functions
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _msgSender() internal view override returns (address sender) {
        if (msg.sender == trustedForwarder) {
            // Extract the original sender from the end of the calldata
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

    function _msgData() internal view override returns (bytes calldata) {
        if (msg.sender == trustedForwarder) {
            // Remove the last 20 bytes (address) from the calldata
            return msg.data[:msg.data.length - 20];
        }
        else {
            return msg.data;
        }
    }
}