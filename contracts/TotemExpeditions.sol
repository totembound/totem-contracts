// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ITotemAchievements } from "./interfaces/ITotemAchievements.sol";
import { ITotemExpeditions } from "./interfaces/ITotemExpeditions.sol";
import { TotemToken } from "./TotemToken.sol";
import { TotemNFT } from "./TotemNFT.sol";
import { TotemGame } from "./TotemGame.sol";

// Basic error definitions
error InvalidAddress();
error InvalidForwarderAddress();
error ExpeditionNotFound();
error NotTokenOwner();
error TotemsOnExpedition();
error InvalidCaptainDomain();
error TotemHappinessLow();
error PaymentFailed();
error ExpeditionNotComplete();
error ExpeditionAlreadyClaimed();
error GameProcessingFailed();
error ActiveExpeditionExists();
error InsufficientTotemStage();

contract TotemExpeditions is ITotemExpeditions, Initializable, OwnableUpgradeable, UUPSUpgradeable {

    struct ExpeditionConfig {
        string name;
        Domain domain;
        uint256 duration;         // in seconds
        uint256 totemCost;        // TOTEM tokens per expedition
        uint256 happinessCost;    // per totem
        uint256 baseExperience;   // per totem
        uint8[3] affinityWeights; // [Strength, Agility, Wisdom] weights (0-10)
        uint8[3] runeDropChances; // [Lesser, Greater, Ancient]
        uint8 minStage;           // Minimum stage requirement
        bool enabled;
    }
    
    struct UserExpedition {
        bytes32 expeditionId;
        uint256[3] totemIds;
        uint256 startTime;
        uint256 endTime;
        bool completed;
    }
    
    // State variables
    TotemToken public totemToken;
    TotemNFT public totemNFT;
    TotemGame public game;
    ITotemAchievements public achievements;
    address public trustedForwarder;
    
    // Simplified storage
    mapping(bytes32 => ExpeditionConfig) private _expeditionConfigs;
    mapping(uint256 => bool) private _totemInExpedition;
    mapping(uint256 => uint256) private _totemExpeditionEndTime;
    mapping(address => UserExpedition[]) private _userExpeditions;
    bytes32[] private _expeditionIds;
    
    // Achievement tracking
    bytes32 private constant _TUTORIAL_ACHIEVEMENT_ID = keccak256("expedition_explorer");
    bytes32 private constant _EXPEDITION_ACHIEVEMENT_ID = keccak256("expedition_progression");
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the expedition contract
     * @param _totemToken Address of the TotemToken contract
     * @param _totemNFT Address of the TotemNFT contract
     * @param _trustedForwarder Address for meta-transactions
     */
    function initialize(
        address _game,
        address _totemToken,
        address _totemNFT,
        address _trustedForwarder
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        if (_game == address(0)) revert InvalidAddress();
        if (_totemToken == address(0)) revert InvalidAddress();
        if (_totemNFT == address(0)) revert InvalidAddress();
        if (_trustedForwarder == address(0)) revert InvalidForwarderAddress();
        
        game = TotemGame(payable(_game));
        totemToken = TotemToken(_totemToken);
        totemNFT = TotemNFT(_totemNFT);
        trustedForwarder = _trustedForwarder;
    }
    
    /**
     * @dev Creates or updates an expedition configuration
     */
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
    ) external onlyOwner {
        // Generate expedition ID from string
        bytes32 expeditionId = keccak256(bytes(idString));
        
        // Configure expedition
        _expeditionConfigs[expeditionId] = ExpeditionConfig({
            name: name,
            domain: Domain(domain),
            duration: duration,
            totemCost: totemCost,
            happinessCost: happinessCost,
            baseExperience: baseExperience,
            affinityWeights: affinityWeights,
            runeDropChances: runeDropChances,
            minStage: minStage,
            enabled: true
        });
        
        // Add to expedition IDs if new
        _addToExpeditions(expeditionId);
        
        emit ExpeditionConfigured(expeditionId, name, Domain(domain));
    }
    
    /**
     * @dev Start an expedition with 3 totems (1 captain + 2 team members)
     */
    function startExpedition(
        bytes32 expeditionId,
        uint256[3] memory totemIds
    ) external {
        address user = _msgSender();
        
        // Validate expedition configuration
        ExpeditionConfig storage config = _expeditionConfigs[expeditionId];
        if (bytes(config.name).length == 0) revert ExpeditionNotFound();
        if (!config.enabled) revert ExpeditionNotFound();
        
        // Check if user already has an active expedition
        UserExpedition[] storage userExps = _userExpeditions[user];
        for (uint256 i = 0; i < userExps.length; i++) {
            if (userExps[i].expeditionId == expeditionId && !userExps[i].completed) {
                revert ActiveExpeditionExists();
            }
        }
        
        uint256 captainId = totemIds[0];

        for (uint256 i = 0; i < 3; i++) {
            // Validate token ownership
            if (totemNFT.ownerOf(totemIds[i]) != user) revert NotTokenOwner();
            // Check if totems are already on expedition
            if (_totemInExpedition[totemIds[i]]) revert TotemsOnExpedition();
        }
        
        // Get captain attributes - need to access the NFT's metadata to get domain
        (
            TotemNFT.Species captainSpecies,
            ,
            ,
            uint256 captainHappiness,
            ,
            uint256 captainStage,
            ,
            ,
        ) = totemNFT.attributes(captainId);
        
        // Check captain happiness
        if (captainHappiness < config.happinessCost) revert TotemHappinessLow();
        if (captainStage < config.minStage) revert InsufficientTotemStage();

        Domain captainDomain = _getTotemDomain(captainSpecies);

        // Check if captain domain matches expedition domain
        if (captainDomain != config.domain) revert InvalidCaptainDomain();
        
        // Check other member happiness
        for (uint256 i = 1; i < 3; i++) {
            (
                ,
                ,
                ,
                uint256 memberHappiness,
                ,
                uint256 memberStage,
                ,
                ,
            ) = totemNFT.attributes(totemIds[i]);
            
            if (memberHappiness < config.happinessCost) revert TotemHappinessLow();
            if (memberStage < config.minStage) revert InsufficientTotemStage();
        }

        // Take payment
        bool feeProcessed = game.processExpeditionFee(
            expeditionId,
            user, 
            config.totemCost, 
            config.happinessCost, 
            totemIds
        );
        
        if (!feeProcessed) revert GameProcessingFailed();
        
        // Calculate expedition end time
        uint256 endTime = block.timestamp + config.duration;
        
        // Mark totems as on expedition
        for (uint256 i = 0; i < 3; i++) {
            _totemInExpedition[totemIds[i]] = true;
            _totemExpeditionEndTime[totemIds[i]] = endTime;
        }
        
        // Record user expedition
        _userExpeditions[user].push(UserExpedition({
            expeditionId: expeditionId,
            totemIds: totemIds,
            startTime: block.timestamp,
            endTime: endTime,
            completed: false
        }));
        
        emit ExpeditionStarted(user, expeditionId, totemIds, endTime);
    }
    
    /**
     * @dev Claim rewards for a completed expedition
     */
    function claimExpeditionRewards(bytes32 expeditionId) external {
        address user = _msgSender();
        
        // Find the expedition with this ID
        uint256 expeditionIndex = type(uint256).max; // Invalid value
        UserExpedition[] storage userExps = _userExpeditions[user];
        
        // Start from the end to find the most recent expeditions first
        for (uint256 i = userExps.length; i > 0; i--) {
            uint256 index = i - 1; // Prevents underflow
            if (userExps[index].expeditionId == expeditionId) {
                expeditionIndex = index;
                break;
            }
        }
        
        // Verify expedition exists
        if (expeditionIndex == type(uint256).max) revert ExpeditionNotFound();
        UserExpedition storage expedition = _userExpeditions[user][expeditionIndex];

        // Verify it can be claimed
        if (expedition.completed) revert ExpeditionAlreadyClaimed();
        if (block.timestamp < expedition.endTime) revert ExpeditionNotComplete();
        
        // Mark as completed
        expedition.completed = true;
        
        // Release totems from expedition
        for (uint256 i = 0; i < 3; i++) {
            _totemInExpedition[expedition.totemIds[i]] = false;
        }
        
        // Get expedition config
        ExpeditionConfig storage config = _expeditionConfigs[expedition.expeditionId];
        
        // Calculate expedition success (score out of 100)
        uint256 score = _calculateExpeditionScore(
            expedition.totemIds, 
            config
        );

        // Calculate rewards based on score
        bool isSuccess = score >= 70; // 70% threshold for success
        bool isGreatSuccess = score >= 90; // 90% threshold for great success
        uint256 expMultiplier = isGreatSuccess ? 150 : (isSuccess ? 125 : 50);
        uint256 finalExperience = (config.baseExperience * expMultiplier) / 100;

        // Determine rune rewards
        uint256[3] memory runeRewards;
        
        // Calculate if each rune type is awarded based on chance
        // Apply success multiplier
        uint256 successMultiplier = isGreatSuccess ? 130 : (isSuccess ? 100 : 50);
        
        for (uint8 i = 0; i < 3; i++) {
            uint8 dropChance = config.runeDropChances[i];
            if (dropChance > 0) {
                // Apply success multiplier to drop chance
                uint256 finalChance = (dropChance * successMultiplier) / 100;
   
                // Determine base quantity based on expedition duration
                uint256 baseQuantity = 1;
         
                // For Lesser runes (i == 0), increase quantity based on expedition duration
                if (i == 0) { // Lesser rune type
                    if (config.duration >= 86400) { // 24h (86400 seconds)
                        baseQuantity = 3;
                    } else if (config.duration >= 43200) { // 12h (43200 seconds)
                        baseQuantity = 2;
                    }
                }

                if (dropChance >= 100) {
                    runeRewards[i] = baseQuantity; // Award 1 rune of this type
                } else {
                    // Random number from 1-100 based on current block properties
                    uint256 rand = uint256(keccak256(abi.encodePacked(
                        block.timestamp, 
                        block.prevrandao, 
                        expedition.totemIds[0], 
                        i
                    ))) % 100 + 1;
                    
                    if (rand <= finalChance) {
                        runeRewards[i] = baseQuantity; // Award 1 rune of this type
                    }
                }
            }
        }
        
        // Process rewards through TotemGame
        bool rewardsProcessed = game.processExpeditionRewards(
            expedition.expeditionId,
            user,
            finalExperience,
            expedition.totemIds,
            runeRewards,
            score
        );
        
        if (!rewardsProcessed) revert GameProcessingFailed();
        
        // Update achievements
        if (address(achievements) != address(0)) {
            achievements.updateProgress(_EXPEDITION_ACHIEVEMENT_ID, user, 1);
        }
        
        emit ExpeditionCompleted(user, expedition.expeditionId, expedition.totemIds);
    }
    
    /**
     * @dev Set achievements contract reference
     */
    function setAchievements(address _achievements) external onlyOwner {
        if (_achievements == address(0)) revert InvalidAddress();
        achievements = ITotemAchievements(_achievements);
    }
    
    function setGame(address _game) external onlyOwner {
        if (_game == address(0)) revert InvalidAddress();
        game = TotemGame(payable(_game));
    }

    /**
     * @dev Check if a totem is on an expedition
     */
    function isTotemOnExpedition(uint256 tokenId) external view returns (bool, uint256) {
        if (_totemInExpedition[tokenId]) {
            return (true, _totemExpeditionEndTime[tokenId]);
        }
        return (false, 0);
    }
    
    /**
     * @dev Get all expedition configurations
     */
    function getExpeditions() external view returns (bytes32[] memory) {
        return _expeditionIds;
    }
    
    /**
     * @dev Get expedition configuration
     */
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
    ) {
        ExpeditionConfig storage config = _expeditionConfigs[expeditionId];
        
        return (
            config.name,
            uint8(config.domain),
            config.duration,
            config.totemCost,
            config.happinessCost,
            config.baseExperience,
            config.affinityWeights,
            config.runeDropChances,
            config.minStage,
            config.enabled
        );
    }
    
    /**
     * @dev Get user's expeditions
     */
    function getUserExpeditions(address user) external view returns (
        bytes32[] memory ids,
        uint256[][] memory totemIds,
        uint256[] memory endTimes,
        bool[] memory completed,
        bool[] memory canClaim
    ) {
        UserExpedition[] storage userExps = _userExpeditions[user];
        uint256 count = userExps.length;
        
        ids = new bytes32[](count);
        totemIds = new uint256[][](count);
        endTimes = new uint256[](count);
        completed = new bool[](count);
        canClaim = new bool[](count);
        
        for (uint256 i = 0; i < count; i++) {
            UserExpedition storage exp = userExps[i];
            ids[i] = exp.expeditionId;
            totemIds[i] = new uint256[](3);
            totemIds[i][0] = exp.totemIds[0];
            totemIds[i][1] = exp.totemIds[1];
            totemIds[i][2] = exp.totemIds[2];
            endTimes[i] = exp.endTime;
            completed[i] = exp.completed;
            canClaim[i] = !exp.completed && block.timestamp >= exp.endTime;
        }
        
        return (ids, totemIds, endTimes, completed, canClaim);
    }
    
    /**
    * @dev Get user's active expeditions
    */
    function getUserActiveExpeditions(address user) external view returns (
        bytes32[] memory ids,
        uint256[][] memory totemIds,
        uint256[] memory endTimes,
        bool[] memory canClaim
    ) {
        UserExpedition[] storage userExps = _userExpeditions[user];
        
        // First count active expeditions
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userExps.length; i++) {
            if (!userExps[i].completed) {
                activeCount++;
            }
        }
        
        // Create arrays of appropriate size
        ids = new bytes32[](activeCount);
        totemIds = new uint256[][](activeCount);
        endTimes = new uint256[](activeCount);
        canClaim = new bool[](activeCount);
        
        // Fill arrays with active expedition data
        uint256 index = 0;
        for (uint256 i = 0; i < userExps.length; i++) {
            UserExpedition storage exp = userExps[i];
            if (!exp.completed) {
                ids[index] = exp.expeditionId;
                totemIds[index] = new uint256[](3);
                totemIds[index][0] = exp.totemIds[0];
                totemIds[index][1] = exp.totemIds[1];
                totemIds[index][2] = exp.totemIds[2];
                endTimes[index] = exp.endTime;
                canClaim[index] = block.timestamp >= exp.endTime;
                index++;
            }
        }
        
        return (ids, totemIds, endTimes, canClaim);
    }

    /**
     * @dev Add expedition ID to the list if not already present
     */
    function _addToExpeditions(bytes32 expeditionId) internal {
        for (uint256 i = 0; i < _expeditionIds.length; i++) {
            if (_expeditionIds[i] == expeditionId) {
                return;
            }
        }
        _expeditionIds.push(expeditionId);
    }

    function _calculateExpeditionScore(
        uint256[3] memory totemIds,
        ExpeditionConfig storage config
    ) internal view returns (uint256) {
        // Base score starts at 50 (out of 100)
        uint256 score = 50;
        
        // Check domain bonus for captain
        (
            TotemNFT.Species captainSpecies,
            ,
            ,
            ,
            ,
            uint256 captainStage,
            ,
            ,
            
        ) = totemNFT.attributes(totemIds[0]);

        Domain captainDomain = _getTotemDomain(captainSpecies);
        // Captain domain match bonus (+15)
        if (captainDomain == config.domain) {
            score += 15;
        }
        
        // Captain Elder stage bonus (+10)
        if (captainStage >= 4) {
            score += 10;
        }

        // Check affinity matches and domain matches for all team members
        uint256[3] memory affinityMatches;
        uint256 domainMatches = 0;
        
        // Count captain domain match
        if (captainDomain == config.domain) {
            domainMatches++;
        }
        
        for (uint256 i = 1; i < 3; i++) {
            (
                TotemNFT.Species species,
                ,
                ,
                ,
                ,
                ,
                ,
                ,
                
            ) = totemNFT.attributes(totemIds[i]);

            // Count affinity matches
            affinityMatches[uint8(_getTotemAffinity(species))]++;
            
            // Count domain matches for team members
            Domain memberDomain = _getTotemDomain(species);
            if (memberDomain == config.domain) {
                domainMatches++;
            }
        }
        
        // Domain synergy bonus - reward teams with matching domains
        if (domainMatches == 3) {
            score += 15; // All same domain bonus
        } else if (domainMatches == 2) {
            score += 8; // Partial domain bonus
        }
        
        // Find which affinity weight is highest (primary)
        uint8 primaryAffinityIndex = 0;
        if (config.affinityWeights[1] > config.affinityWeights[primaryAffinityIndex]) {
            primaryAffinityIndex = 1;
        }
        if (config.affinityWeights[2] > config.affinityWeights[primaryAffinityIndex]) {
            primaryAffinityIndex = 2;
        }
        
        // Bonus for having totems with the primary affinity
        if (affinityMatches[primaryAffinityIndex] > 0) {
            score += 5 + (affinityMatches[primaryAffinityIndex] * 3); // Scale with count
        }
        
        // Team composition bonuses
        bool hasSharedAffinity = false;
        bool hasAllThreeAffinities = (affinityMatches[0] > 0 && affinityMatches[1] > 0 && affinityMatches[2] > 0);
        
        for (uint256 i = 0; i < 3; i++) {
            if (affinityMatches[i] >= 2) {
                hasSharedAffinity = true;
                break;
            }
        }
        
        // Synergy bonuses
        if (hasSharedAffinity) {
            // Bonus for having at least 2 totems with same affinity (+8)
            score += 8;
        }
        
        if (hasAllThreeAffinities) {
            // Bonus for balanced team with all affinities (+5)
            score += 5;
        }
        
        // Add some randomness, ±3 points
        uint256 randomness = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            totemIds[0], 
            totemIds[1], 
            totemIds[2]
        ))) % 7; // 0-6
        
        // Adjust score with randomness (±3)
        score = score + randomness - 3;
        
        // Ensure score is capped 0-100
        if (score > 100) {
            score = 100;
        }
        
        return score;
    }
    
     function _getTotemAffinity(TotemNFT.Species species) internal pure returns (Affinity) {
        // Map species to affinity based on their primary stat
        if (species == TotemNFT.Species.Bear || 
            species == TotemNFT.Species.Wolf || 
            species == TotemNFT.Species.Beaver || 
            species == TotemNFT.Species.Turtle) {
            return Affinity.Strength;
        } 
        else if (species == TotemNFT.Species.Falcon || 
                species == TotemNFT.Species.Deer || 
                species == TotemNFT.Species.Otter || 
                species == TotemNFT.Species.Woodpecker) {
            return Affinity.Agility;
        }
        else {
            return Affinity.Wisdom; // Owl, Raven, Goose, Snake
        }
    }

     function _getTotemDomain(TotemNFT.Species species) internal pure returns (Domain) {
        // Map species to domain
        if (species == TotemNFT.Species.Goose ||
            species == TotemNFT.Species.Otter || 
            species == TotemNFT.Species.Beaver || 
            species == TotemNFT.Species.Turtle) {
            return Domain.Water;
        } 
        else if (species == TotemNFT.Species.Falcon || 
                species == TotemNFT.Species.Raven || 
                species == TotemNFT.Species.Owl || 
                species == TotemNFT.Species.Woodpecker) {
            return Domain.Air;
        } 
        else {
            return Domain.Earth; // Bear, Wolf, Deer, Snake
        }
    }

    // Upgrade authorization
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Authorization check is handled by onlyOwner modifier
    }

    // Meta-transaction handling
    function _msgSender() internal view override returns (address sender) {
        if (msg.sender == trustedForwarder) {
            // Extract the original sender from the end of the calldata
            // solhint-disable-next-line
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }

    function _msgData() internal view override returns (bytes calldata) {
        if (msg.sender == trustedForwarder) {
            // Remove the last 20 bytes (address) from the calldata
            return msg.data[:msg.data.length - 20];
        } else {
            return msg.data;
        }
    }
}