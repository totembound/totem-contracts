// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ITotemAchievements } from "./interfaces/ITotemAchievements.sol";
import { ITotemChallenges } from "./interfaces/ITotemChallenges.sol";
import { TotemToken } from "./TotemToken.sol";
import { TotemNFT } from "./TotemNFT.sol";

error AlreadySignedUp();
error NotSignedUp();
error NoPolSent();
error InsufficientTokens();
error PolTransferFailed();
error PurchaseFailed();
error ActionNotAvailable();
error PaymentFailed();
error InvalidAddress();
error InvalidTokenId();
error InvalidSignupReward();
error InvalidMintPrice();
error InvalidWindow1();
error InvalidWindow2();
error InvalidWindow3();
error InvalidActionCost();
error InvalidHappinessChange();
error InvalidExperienceGain();
error InvalidForwarderAddress();
error NoPolToWithdraw();
error InvalidSpecies();
error NotTokenOwner();
error TotemNotAvailable();
error ChallengeNotAvailable();
error TotemIneligible();
error InvalidScore();
error DailyChallengesExceeded();
error BundleNotAvailable();
error BundleExpired();
error InvalidAmount();
error InvalidRarityRange();

contract TotemGame is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // Core structs for Game configuration
    enum ActionType {
        Feed,
        Train,
        Treat
        // Future actions can be added here
    }

    struct ActionConfig {
        uint256 cost;            // TOTEM cost
        uint256 cooldown;        // Cooldown in seconds
        uint256 maxDaily;        // Max uses per day (0 for unlimited)
        uint256 minHappiness;    // Minimum happiness required
        uint256 happinessChange; // Positive or negative change to happiness
        uint256 experienceGain;  // Experience gained (0 for non-training actions)
        bool useTimeWindows;     // Whether action uses time windows
        bool increasesHappiness; // Whether this action increases (true) or decreases (false) happiness
        bool enabled;            // Whether the action is currently enabled
    }
    
    struct ActionTracking {
        uint256 lastUsed;        // Timestamp of last use
        uint256 dailyUses;       // Number of uses today
        uint256 dayStartTime;    // Start of current day for counting
    }

    struct GameParameters {
        uint256 signupReward;    // Initial TOTEM reward
        uint256 mintPrice;       // TOTEM cost to mint
    }

    struct TimeWindows {
        uint256 window1Start;    // UTC 00:00
        uint256 window2Start;    // UTC 08:00
        uint256 window3Start;    // UTC 16:00
    }

    struct GameConfiguration {
        GameParameters params;
        TimeWindows windows;
        mapping(ActionType => ActionConfig) actionConfigs;
    }

    struct UnboundTotem {
        uint256 tokenId;
        address previousOwner;
        uint256 sellPrice;
        // Include relevant attributes from the NFT
        TotemNFT.Species species;
        TotemNFT.Color color;
        TotemNFT.Rarity rarity;
        uint256 happiness;
        uint256 experience;
        uint256 stage;
        string displayName;
        uint256 prestigeLevel;
    }

    struct Bundle {
        uint256 polCost;           // Cost in POL
        uint256 tokenAmount;       // TOTEM token amount
        TotemNFT.Species species;  // Specific species or None for random
        TotemNFT.Color color;      // Specific color or None for random
        TotemNFT.Rarity minRarity; // Minimum rarity for random NFTs
        TotemNFT.Rarity maxRarity; // Maximum rarity for random NFTs
        bool enabled;              // Whether bundle is available
        bool isLimitedRarity;      // If true, NFT will be Limited rarity
        uint256 validUntil;        // Unix timestamp when bundle expires (0 for no expiry)
    }

    // State variables
    TotemToken public totemToken;
    TotemNFT public totemNFT;
    ITotemAchievements public achievements;
    ITotemChallenges public challenges;
    address public trustedForwarder;
    GameParameters public gameParams;
    TimeWindows public timeWindows;
    mapping(address => bool) public hasSignedUp;
    mapping(uint256 => UnboundTotem) public unboundTotems;
    uint256[] private _unboundTokenIds;
    mapping(uint256 => Bundle) public bundles;
    uint256 public nextBundleId;

    // Action configuration and tracking
    mapping(ActionType => ActionConfig) public actionConfigs;
    mapping(uint256 => mapping(ActionType => ActionTracking)) public actionTracking;

    // Constants
    uint256 private constant _SECONDS_PER_DAY = 86400;
    bytes32 private constant _FEED_ACHIEVEMENT_ID = keccak256("feed_progression");
    bytes32 private constant _TREAT_ACHIEVEMENT_ID = keccak256("treat_progression");
    bytes32 private constant _TRAIN_ACHIEVEMENT_ID = keccak256("train_progression");

    // Events
    event GameParametersUpdated(GameParameters params);
    event TimeWindowsUpdated(TimeWindows windows);
    event ActionConfigUpdated(ActionType indexed actionType, ActionConfig config);
    event ActionPerformed(uint256 indexed tokenId, ActionType actionType);
    event UserSignedUp(address indexed user);
    event TotemPurchased(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TotemSold(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TotemUnbound(address indexed user, uint256 indexed tokenId, uint256 amount);
    event ChallengeCompleted(bytes32 indexed challengeId, uint256 indexed tokenId, uint256 score);
    event TrustedForwarderUpdated(address newForwarder);
    event BundleCreated(uint256 indexed bundleId, Bundle bundle);
    event BundlePurchased(address indexed user, uint256 indexed bundleId, uint256 tokenId, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _totemToken,
        address _totemNFT,
        address _trustedForwarder,
        GameParameters memory _initialParams,
        TimeWindows memory _initialWindows
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        totemToken = TotemToken(_totemToken);
        totemNFT = TotemNFT(_totemNFT);
        trustedForwarder = _trustedForwarder;
        gameParams = _initialParams;
        timeWindows = _initialWindows;

        // Initialize default action configurations
        actionConfigs[ActionType.Feed] = ActionConfig({
            cost: 10 * 10**18,           // 10 TOTEM
            cooldown: 0,                 // No cooldown
            maxDaily: 3,                 // 3 times per day
            minHappiness: 0,             // No minimum
            happinessChange: 10,         // +10 happiness
            experienceGain: 0,           // No experience
            useTimeWindows: true,        // Uses time windows
            increasesHappiness: true,    // Increases happiness
            enabled: true                // Enabled by default
        });

        actionConfigs[ActionType.Train] = ActionConfig({
            cost: 20 * 10**18,           // 20 TOTEM
            cooldown: 0,                 // No cooldown
            maxDaily: 0,                 // Unlimited
            minHappiness: 20,            // Minimum 20 happiness
            happinessChange: 10,         // 10 happiness
            experienceGain: 50,          // +50 experience
            useTimeWindows: false,       // No time windows
            increasesHappiness: false,   // Decreases happiness
            enabled: true                // Enabled by default
        });

        actionConfigs[ActionType.Treat] = ActionConfig({
            cost: 20 * 10**18,           // 20 TOTEM
            cooldown: 14400,             // 4 hour cooldown
            maxDaily: 0,                 // Unlimited
            minHappiness: 0,             // No minimum
            happinessChange: 10,         // +10 happiness
            experienceGain: 0,           // No experience
            useTimeWindows: false,       // No time windows
            increasesHappiness: true,    // Increases happiness
            enabled: true                // Enabled by default
        });
    }

    function signup() external {
        address user = _msgSender();
        if (hasSignedUp[user]) revert AlreadySignedUp();
        
        // Mark as signed up and give initial tokens
        hasSignedUp[user] = true;
        totemToken.transfer(user, gameParams.signupReward);

        emit UserSignedUp(user);
    }

    function buyTokens() external payable {
        address user = _msgSender();
        if (!hasSignedUp[user]) revert NotSignedUp();
        if (msg.value == 0) revert NoPolSent();

        // Calculate token amount based on sent POL
        uint256 tokenAmount = (msg.value * 10**18) / totemToken.getTokenPrice();
        
        // Ensure sufficient tokens in contract
        if (totemToken.balanceOf(address(this)) < tokenAmount) revert InsufficientTokens();
        
        // Transfer tokens to user
        totemToken.transfer(user, tokenAmount);
        
        // Forward received POL to a specific address
        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        if (!sent) revert PolTransferFailed();
    }

    // This is where users spend TOTEM to get their NFT
    function purchaseTotem(uint8 speciesId) external returns (uint256 tokenId) {
        address user = _msgSender();
        if (!hasSignedUp[user]) revert NotSignedUp();
        if (speciesId >= uint8(TotemNFT.Species.None)) revert InvalidSpecies();

        // Take payment for the totem
        if (!totemToken.transferFrom(user, address(this), gameParams.mintPrice))
            revert PurchaseFailed();
        
        // Mint their chosen totem
        tokenId = totemNFT.mint(user, TotemNFT.Species(speciesId));

         // Initialize action tracking
        _initializeActionTracking(tokenId);

        emit TotemPurchased(user, tokenId, gameParams.mintPrice);

        return tokenId;
    }

    function sellTotem(uint256 tokenId) external {
        address user = _msgSender();
        if (user != totemNFT.ownerOf(tokenId)) revert NotTokenOwner();
        
        (TotemNFT.Species species,
         TotemNFT.Color color,
         TotemNFT.Rarity rarity,
         uint256 happiness,
         uint256 experience,
         uint256 stage,
         ,
         string memory displayName,
         uint256 prestigeLevel
        ) = totemNFT.attributes(tokenId);

        // Calculate value based on stage and rarity
        uint256 sellValue = _calculateSellPrice(stage, rarity);

        // Store unbound totem data
        unboundTotems[tokenId] = UnboundTotem({
            tokenId: tokenId,
            previousOwner: user,
            sellPrice: sellValue,
            species: species,
            color: color,
            rarity: rarity,
            happiness: happiness,
            experience: experience,
            stage: stage,
            displayName: displayName,
            prestigeLevel: prestigeLevel
        });
        
        _unboundTokenIds.push(tokenId);

        // Transfer NFT to game contract
        totemNFT.gameTransferFrom(user, address(this), tokenId);

        // Transfer TOTEM tokens to seller
        totemToken.transfer(user, sellValue);

        emit TotemSold(user, tokenId, sellValue);
    }

    function purchaseUnboundTotem(uint256 tokenId) external {
        address user = _msgSender();
        if (!hasSignedUp[user]) revert NotSignedUp();
        
        UnboundTotem memory totem = unboundTotems[tokenId];
        if (totem.tokenId != tokenId) revert InvalidTokenId();
        if (totemNFT.ownerOf(tokenId) != address(this)) revert TotemNotAvailable();
        
        // Calculate purchase price with +100 fee
        uint256 purchasePrice = totem.sellPrice + 100 * 10**18;
        
        // Take payment
        if (!totemToken.transferFrom(user, address(this), purchasePrice))
            revert PaymentFailed();
        
        // Transfer totem to buyer
        totemNFT.transferFrom(address(this), user, tokenId);
        
        // Remove from unbound collections
        delete unboundTotems[tokenId];
        _removeUnboundToken(tokenId);
        
        emit TotemUnbound(user, tokenId, purchasePrice);
    }

    function purchaseBundle(uint256 bundleId) external payable returns (uint256 tokenId) {
        address user = _msgSender();
        if (!hasSignedUp[user]) revert NotSignedUp();

        Bundle storage bundle = bundles[bundleId];
        if (!bundle.enabled) revert BundleNotAvailable();
        if (msg.value != bundle.polCost) revert InvalidAmount();
        if (bundle.validUntil != 0 && block.timestamp > bundle.validUntil) revert BundleExpired();

        // Check token balances
        if (totemToken.balanceOf(address(this)) < bundle.tokenAmount) {
            revert InsufficientTokens();
        }
        
        // Transfer TOTEM tokens first
        if (!totemToken.transfer(user, bundle.tokenAmount)) revert PaymentFailed();
        
        // Mint NFT
        if (bundle.species == TotemNFT.Species.None) {
            // Random species, nft will determine rarity and color with oracle
            uint8[4] memory availableSpecies = [1, 2, 3, 11];
            uint8 randomIndex = uint8(block.timestamp % availableSpecies.length);
            uint8 randomSpecies = availableSpecies[randomIndex];
            tokenId = totemNFT.mintWithRarity(
                user, 
                TotemNFT.Species(randomSpecies),
                bundle.minRarity,
                bundle.maxRarity
            );
        } else {
            // Specific species and possibly color
            tokenId = totemNFT.mintLimited(
                user,
                bundle.species,
                bundle.color,
                bundle.isLimitedRarity ? TotemNFT.Rarity.Limited : bundle.minRarity
            );
        }

        // Initialize tracking
        _initializeActionTracking(tokenId);

        // Forward POL to owner
        (bool sent,) = payable(owner()).call{value: msg.value}("");
        if (!sent) revert PolTransferFailed();

        emit BundlePurchased(user, bundleId, tokenId, msg.value);

        return tokenId;
    }

    // Core challenge functions
    function attemptChallenge(
        bytes32 challengeId,
        uint256 tokenId,
        uint256 score
    ) external {
        address user = _msgSender();
        if (totemNFT.ownerOf(tokenId) != user) revert NotTokenOwner();

        // Get challenge info
        (
            ,
            ,
            ,
            ,
            ITotemChallenges.Requirements memory reqs,
            ,
            uint256 maxScore,
            bool enabled
        ) = challenges.getChallengeInfo(challengeId);

        if (!enabled) revert ChallengeNotAvailable();

        // Get totem attributes for validation
        (
            TotemNFT.Species species,
            ,
            TotemNFT.Rarity rarity,
            ,
            ,
            uint256 stage,
            ,
            ,
        ) = totemNFT.attributes(tokenId);

        // Verify eligibility
        if (stage + 1 < reqs.stage) revert TotemIneligible();

        // Get base stats for species/rarity
        (uint256 strength, uint256 agility, uint256 wisdom) = totemNFT.getSpeciesBaseStats(species, rarity);

        // Check attribute requirements
        if (strength < reqs.strength ||
            agility < reqs.agility ||
            wisdom < reqs.wisdom) {
            revert TotemIneligible();
        }

        // Verify score is within bounds
        if (score > maxScore) revert InvalidScore();

        // Complete challenge and update state
        challenges.completeChallenge(challengeId, user, tokenId, score);

        // Award experience based on score percentage
        uint256 expGain = challenges.calculateExperienceGain(score, maxScore);
        totemNFT.updateAttributes(
            tokenId,
            10,  // Small happiness boost
            true,
            expGain
        );

        emit ChallengeCompleted(challengeId, tokenId, score);
    }

    // Convenience functions for actions
    function feed(uint256 tokenId) external {
        executeAction(tokenId, ActionType.Feed);
    }

    function train(uint256 tokenId) external {
        executeAction(tokenId, ActionType.Train);
    }

    function treat(uint256 tokenId) external {
        executeAction(tokenId, ActionType.Treat);
    }

    function setMetadataURI(
        TotemNFT.Species species,
        TotemNFT.Color color,
        uint256 stage,
        string memory ipfsHash
    ) external onlyOwner {
        totemNFT.setMetadataURI(species, color, stage, ipfsHash);
    }

    function setMetadataURIs(
        TotemNFT.Species[] calldata species,
        TotemNFT.Color[] calldata colors,
        uint256[] calldata stages,
        string[] calldata ipfsHashes
    ) external onlyOwner {
        totemNFT.batchSetMetadataURIs(species, colors, stages, ipfsHashes);
    }

    function setValidColorsForRarities(
        uint256[] calldata rarities,
        uint256[] calldata colors
    ) external onlyOwner {
        totemNFT.setValidColorsForRarities(rarities, colors);
    }

    function setStageThresholds(uint256[4] calldata thresholds) external {
        totemNFT.setStageThresholds(thresholds);
    }

    function createBundle(
        uint256 polCost,
        uint256 tokenAmount,
        TotemNFT.Species species,
        TotemNFT.Color color,
        TotemNFT.Rarity minRarity,
        TotemNFT.Rarity maxRarity,
        bool isLimitedRarity,
        uint256 validUntil
    ) external onlyOwner returns (uint256) {
        if (polCost <= 0) revert InvalidAmount();
        if (tokenAmount <= 0) revert InvalidAmount();
        if (minRarity > maxRarity) revert InvalidRarityRange();
        
        uint256 bundleId = nextBundleId++;
        bundles[bundleId] = Bundle({
            polCost: polCost,
            tokenAmount: tokenAmount,
            species: species,
            color: color,
            minRarity: minRarity,
            maxRarity: maxRarity,
            enabled: true,
            isLimitedRarity: isLimitedRarity,
            validUntil: validUntil
        });

        emit BundleCreated(bundleId, bundles[bundleId]);
        return bundleId;
    }

    function configureChallenge(
        bytes32 challengeId,
        string memory name,
        string memory description,
        ITotemChallenges.ChallengeType challengeType,
        ITotemChallenges.ChallengeAttribute attribute,
        ITotemChallenges.Requirements memory requirements,
        uint256 maxDailyAttempts,
        uint256 maxScore,
        bytes32 achievementId
    ) external onlyOwner {
        challenges.configureChallenge(challengeId, name, description, challengeType, attribute, 
            requirements, maxDailyAttempts, maxScore, achievementId);
    }

    function setChallengeMetadata(
        bytes32 challengeId,
        string calldata key,
        string calldata value
    ) external onlyOwner {
        challenges.setChallengeMetadata(challengeId, key, value);
    }

    function setAchievements(address _achievements) external onlyOwner {
        if (_achievements == address(0)) revert InvalidAddress();
        achievements = ITotemAchievements(_achievements);
    }

    function setChallenges(address _challenges) external onlyOwner {
        if (_challenges == address(0)) revert InvalidAddress();
        challenges = ITotemChallenges(_challenges);
    }

    function updateActionConfig(
        ActionType actionType,
        ActionConfig memory _config
    ) external onlyOwner {
        if (_config.cost <= 0) revert InvalidActionCost();
        if (_config.happinessChange > 100) revert InvalidHappinessChange();
        if (_config.experienceGain > 1000) revert InvalidExperienceGain();
        
        actionConfigs[actionType] = _config;
        emit ActionConfigUpdated(actionType, _config);
    }

    function updateTrustedForwarder(address _newForwarder) external onlyOwner {
        if (_newForwarder == address(0)) revert InvalidForwarderAddress();

        trustedForwarder = _newForwarder;
        totemNFT.updateTrustedForwarder(_newForwarder);

        emit TrustedForwarderUpdated(_newForwarder);
    }

    function withdrawPol() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoPolToWithdraw();
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert PolTransferFailed();
    }

    function updateGameParameters(GameParameters memory _params) external onlyOwner {
        if (_params.signupReward <= 0) revert InvalidSignupReward();
        if (_params.mintPrice <= 0) revert InvalidMintPrice();

        gameParams = _params;
        emit GameParametersUpdated(_params);
    }

    function updateTimeWindows(TimeWindows memory _windows) external onlyOwner {
        if (_windows.window1Start >= _windows.window2Start) revert InvalidWindow1();
        if (_windows.window2Start >= _windows.window3Start) revert InvalidWindow2();
        if (_windows.window3Start >= _SECONDS_PER_DAY) revert InvalidWindow3();
        
        timeWindows = _windows;
        emit TimeWindowsUpdated(_windows);
    }

    // View functions
    function canUseAction(uint256 tokenId, ActionType actionType) external view returns (bool) {
        // Internal implementation details
        return _canUseAction(tokenId, actionType);
    }

    function getGameConfiguration() external view returns (
        GameParameters memory params,
        TimeWindows memory windows,
        ActionConfig[] memory configs
    ) {
        configs = new ActionConfig[](3);  // Assuming 3 action types
        configs[0] = actionConfigs[ActionType.Feed];
        configs[1] = actionConfigs[ActionType.Train];
        configs[2] = actionConfigs[ActionType.Treat];
        
        return (gameParams, timeWindows, configs);
    }

    function getActionTracking(uint256 tokenId, ActionType actionType) 
        external view returns (ActionTracking memory) {
        return actionTracking[tokenId][actionType];
    }

    function getUnboundTotemCount() external view returns (uint256) {
        return _unboundTokenIds.length;
    }

    function getUnboundTokenIds(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256 end = offset + limit;
        if (end > _unboundTokenIds.length) {
            end = _unboundTokenIds.length;
        }
        
        uint256[] memory ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _unboundTokenIds[i];
        }
        return ids;
    }

    function getUnboundTotems(uint256 offset, uint256 limit)
        external
        view
        returns (UnboundTotem[] memory)
    {
        uint256 end = offset + limit;
        if (end > _unboundTokenIds.length) {
            end = _unboundTokenIds.length;
        }
        
        UnboundTotem[] memory totems = new UnboundTotem[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            totems[i - offset] = unboundTotems[_unboundTokenIds[i]];
        }
        return totems;
    }

    function canAttemptChallenge(
        bytes32 challengeId,
        uint256 tokenId
    ) external view returns (bool) {
        if (address(challenges) == address(0)) return false;

        // Get challenge info
        (
            ,
            ,
            ,
            ,
            ITotemChallenges.Requirements memory reqs,
            ,
            ,
            bool enabled
        ) = challenges.getChallengeInfo(challengeId);

        if (!enabled) return false;

        // Get totem attributes
        (
            TotemNFT.Species species,
            ,
            TotemNFT.Rarity rarity,
            ,
            ,
            uint256 stage,
            ,
            ,
        ) = totemNFT.attributes(tokenId);

        // Check stage requirement
        if (stage + 1 < reqs.stage) return false;

        // Get base stats
        (uint256 strength, uint256 agility, uint256 wisdom) = totemNFT.getSpeciesBaseStats(species, rarity);

        // Check attribute requirements
        return (
            strength >= reqs.strength &&
            agility >= reqs.agility &&
            wisdom >= reqs.wisdom
        );
    }

    // Action execution
    function executeAction(uint256 tokenId, ActionType actionType) public {
        address user = _msgSender();
        if (totemNFT.ownerOf(tokenId) != user) revert NotTokenOwner();
        if (!_canUseAction(tokenId, actionType)) revert ActionNotAvailable();

        ActionConfig memory config = actionConfigs[actionType];
        
        // Take payment
        if (!totemToken.transferFrom(user, address(this), config.cost))
            revert PaymentFailed();

        // Update tracking
        _updateActionTracking(tokenId, actionType);

        // Apply effects
        totemNFT.updateAttributes(
            tokenId,
            config.happinessChange,
            config.increasesHappiness,
            config.experienceGain
        );

        // update achievements progression
        if (address(achievements) != address(0)) {
            if (actionType == ActionType.Feed) {
                achievements.updateProgress(_FEED_ACHIEVEMENT_ID, user, 1);
            }
            else if (actionType == ActionType.Treat) {
                achievements.updateProgress(_TREAT_ACHIEVEMENT_ID, user, 1);
            }
            else if (actionType == ActionType.Train) {
                achievements.updateProgress(_TRAIN_ACHIEVEMENT_ID, user, 1);
            }
        }

        emit ActionPerformed(tokenId, actionType);
    }

    // Initialize action tracking when NFT is minted
    function _initializeActionTracking(uint256 tokenId) internal {
        uint256 initialTime = block.timestamp - _SECONDS_PER_DAY;  // Allow immediate use
        uint256 currentDay = (block.timestamp / 1 days) * 1 days;

        // Initialize tracking for all actions
        actionTracking[tokenId][ActionType.Feed] = ActionTracking({
            lastUsed: initialTime,
            dailyUses: 0,
            dayStartTime: currentDay
        });

        actionTracking[tokenId][ActionType.Train] = ActionTracking({
            lastUsed: initialTime,
            dailyUses: 0,
            dayStartTime: currentDay
        });

        actionTracking[tokenId][ActionType.Treat] = ActionTracking({
            lastUsed: initialTime,
            dailyUses: 0,
            dayStartTime: currentDay
        });
    }

    // Action tracking update
    function _updateActionTracking(
        uint256 tokenId,
        ActionType actionType
    ) internal {
        ActionTracking storage tracking = actionTracking[tokenId][actionType];
        uint256 currentTime = block.timestamp;
        uint256 currentDay = (currentTime / 1 days) * 1 days;

        // Reset daily uses if it's a new day
        if (currentDay > tracking.dayStartTime) {
            tracking.dailyUses = 0;
            tracking.dayStartTime = currentDay;
        }

        tracking.lastUsed = currentTime;
        tracking.dailyUses++;
    }

    function _removeUnboundToken(uint256 tokenId) internal {
        for (uint256 i = 0; i < _unboundTokenIds.length; i++) {
            if (_unboundTokenIds[i] == tokenId) {
                _unboundTokenIds[i] = _unboundTokenIds[_unboundTokenIds.length - 1];
                _unboundTokenIds.pop();
                break;
            }
        }
    }

    // Action validation
    function _canUseAction(
        uint256 tokenId,
        ActionType actionType
    ) internal view returns (bool) {
        ActionConfig memory config = actionConfigs[actionType];
        ActionTracking storage tracking = actionTracking[tokenId][actionType];
        uint256 currentTime = block.timestamp;

        // Check if action is enabled
        if (!config.enabled) return false;

        // Get current attributes
        (,,,uint256 happiness,,,,,) = totemNFT.attributes(tokenId);
        if (happiness < config.minHappiness) {
            // Insufficient happiness
            return false;
        }

        // Check cooldown
        if (config.cooldown > 0 && 
            currentTime < tracking.lastUsed + config.cooldown) {
            return false;
        }

        // Check daily limits
        if (config.maxDaily > 0) {
            // If it's a new day, would be allowed
            if (currentTime >= tracking.dayStartTime + 1 days) {
                return true;
            }
            // Otherwise check usage count
            if (tracking.dailyUses >= config.maxDaily) {
                return false;
            }
        }

        // Check time windows if required
        if (config.useTimeWindows) {
            return _isInActiveWindow(tracking.lastUsed);
        }

        return true;
    }

    // Time window validation
    function _isInActiveWindow(uint256 lastUsed) internal view returns (bool) {
        uint256 timestamp = block.timestamp;
        
        // Get day timestamps
        uint256 todayUTC = (timestamp / _SECONDS_PER_DAY) * _SECONDS_PER_DAY;
        uint256 lastUsedDay = (lastUsed / _SECONDS_PER_DAY) * _SECONDS_PER_DAY;
        
        // If different day, allow action
        if (todayUTC > lastUsedDay) return true;
        
        // Get seconds into current day
        uint256 currentDaySeconds = timestamp - todayUTC;
        uint256 lastUsedDaySeconds = lastUsed - lastUsedDay;
        
        // Check if in different window
        if (currentDaySeconds < timeWindows.window2Start) {
            // Window 1: 00:00-08:00
            return lastUsedDaySeconds >= timeWindows.window2Start || 
                   lastUsedDaySeconds < timeWindows.window1Start;
        } else if (currentDaySeconds < timeWindows.window3Start) {
            // Window 2: 08:00-16:00
            return lastUsedDaySeconds < timeWindows.window2Start || 
                   lastUsedDaySeconds >= timeWindows.window3Start;
        } else {
            // Window 3: 16:00-24:00
            return lastUsedDaySeconds < timeWindows.window3Start;
        }
    }

    function _calculatePrestigeBonus(uint256 tokenId, uint256 baseReward) internal view returns (uint256) {
        // Get prestige info from NFT
        (uint256 prestigeLevel,) = totemNFT.getPrestigeInfo(tokenId);
        
        // 5% bonus per prestige level, capped at 100% (20 levels)
        uint256 bonusPercentage = _min(prestigeLevel * 5, 100);
        return baseReward + (baseReward * bonusPercentage / 100);
    }

    // Helper functions
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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

    function _msgData() internal view override returns (bytes calldata) {
        if (msg.sender == trustedForwarder) {
            // Remove the last 20 bytes (address) from the calldata
            return msg.data[:msg.data.length - 20];
        }
        else {
            return msg.data;
        }
    }

    function _calculateSellPrice(uint256 stage, TotemNFT.Rarity rarity) internal pure returns (uint256) {
        // Base calculations in TOTEM (with 18 decimals)
        uint256 baseValue = 200 * 10**18;  // 200 TOTEM minimum
        uint256 maxBonus = 200 * 10**18;   // 200 TOTEM maximum bonus
        
        // Calculate stage bonus (60% weight)
        // stage is 0-4, so divide by 4 to get percentage (0-100%)
        // multiply by 60% (60/100) for weight
        uint256 stageBonus = (stage * maxBonus * 60) / (4 * 100);
        // Calculate rarity bonus (40% weight)
        // rarity is 0-4, so divide by 4 to get percentage (0-100%)
        // multiply by 40% (40/100) for weight
        uint256 rarityBonus = (uint256(rarity) * maxBonus * 40) / (4 * 100);
        // Calculate final sell value
        uint256 sellValue = baseValue + stageBonus + rarityBonus;
        
        return sellValue;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    receive() external payable {}
}