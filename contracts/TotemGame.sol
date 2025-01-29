// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./TotemToken.sol";
import "./TotemNFT.sol";

error AlreadySignedUp();
error NotSignedUp();
error NoPolSent();
error InsufficientTokens();
error PolTransferFailed();
error PurchaseFailed();
error ActionNotAvailable();
error PaymentFailed();
error InvalidSignupReward();
error InvalidMintPrice();
error InvalidWindow1();
error InvalidWindow2();
error InvalidWindow3();
error InvalidActionCost();
error InvalidHappinessChange();
error InvalidExperienceGain();
error InvalidForwarderAddress();
error InsufficientPolBalance();
error NoPolToWithdraw();

contract TotemGame is Initializable, OwnableUpgradeable, UUPSUpgradeable {
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

    // State variables
    TotemToken public totemToken;
    TotemNFT public totemNFT;
    address public trustedForwarder;
    GameParameters public gameParams;
    TimeWindows public timeWindows;
    mapping(address => bool) public hasSignedUp;
    
    // Action configuration and tracking
    mapping(ActionType => ActionConfig) public actionConfigs;
    mapping(uint256 => mapping(ActionType => ActionTracking)) public actionTracking;

    // Events
    event GameParametersUpdated(GameParameters params);
    event TimeWindowsUpdated(TimeWindows windows);
    event ActionConfigUpdated(ActionType indexed actionType, ActionConfig config);
    event ActionPerformed(uint256 indexed tokenId, ActionType actionType);
    event UserSignedUp(address indexed user);
    event TotemPurchased(address indexed user, uint256 indexed tokenId, TotemNFT.Species species);
    event TrustedForwarderFunded(uint256 amount);
    event TrustedForwarderUpdated(address newForwarder);

    // Constants
    uint256 public constant SECONDS_PER_DAY = 86400;

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
            maxDaily: 2,                 // 2 per day
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

    // Initialize action tracking when NFT is minted
    function _initializeActionTracking(uint256 tokenId) internal {
        uint256 initialTime = block.timestamp - SECONDS_PER_DAY;  // Allow immediate use
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

    // This is where users spend TOTEM to get their NFT
    function purchaseTotem(uint8 speciesId) external {
        if (!hasSignedUp[_msgSender()]) revert NotSignedUp();
        if (speciesId >= uint8(TotemNFT.Species.None)) revert InvalidSpecies();

        // Take payment for the totem
        if (!totemToken.transferFrom(_msgSender(), address(this), gameParams.mintPrice))
            revert PurchaseFailed();
        
        // Mint their chosen totem
        // For now, all mints are Common rarity
        uint256 tokenId = totemNFT.mint(_msgSender(), TotemNFT.Species(speciesId), TotemNFT.Rarity.Common);

         // Initialize action tracking
        _initializeActionTracking(tokenId);

        emit TotemPurchased(_msgSender(), tokenId, TotemNFT.Species(speciesId));
    }

    // Action execution
    function executeAction(uint256 tokenId, ActionType actionType) public {
        if (totemNFT.ownerOf(tokenId) != _msgSender()) revert NotTokenOwner();
        if (!_canUseAction(tokenId, actionType)) revert ActionNotAvailable();

        ActionConfig memory config = actionConfigs[actionType];
        
        // Take payment
        if (!totemToken.transferFrom(_msgSender(), address(this), config.cost))
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

        emit ActionPerformed(tokenId, actionType);
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
        (,,,uint256 happiness,,,,) = totemNFT.attributes(tokenId);
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

    function canUseAction(uint256 tokenId, ActionType actionType) external view returns (bool) {
        // Internal implementation details
        return _canUseAction(tokenId, actionType);
    }

    // Time window validation
    function _isInActiveWindow(uint256 lastUsed) internal view returns (bool) {
        uint256 timestamp = block.timestamp;
        
        // Get day timestamps
        uint256 todayUTC = (timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
        uint256 lastUsedDay = (lastUsed / SECONDS_PER_DAY) * SECONDS_PER_DAY;
        
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

    // View functions
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

    // Admin functions for dynamic updates
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

    function updateGameParameters(GameParameters memory _params) external onlyOwner {
        if (_params.signupReward <= 0) revert InvalidSignupReward();
        if (_params.mintPrice <= 0) revert InvalidMintPrice();

        gameParams = _params;
        emit GameParametersUpdated(_params);
    }

    function updateTimeWindows(TimeWindows memory _windows) external onlyOwner {
        if (_windows.window1Start >= _windows.window2Start) revert InvalidWindow1();
        if (_windows.window2Start >= _windows.window3Start) revert InvalidWindow2();
        if (_windows.window3Start >= SECONDS_PER_DAY) revert InvalidWindow3();
        
        timeWindows = _windows;
        emit TimeWindowsUpdated(_windows);
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
        emit TrustedForwarderUpdated(_newForwarder);
    }

    function fundTrustedForwarder(uint256 amount) external onlyOwner {
        if (address(this).balance < amount) revert InsufficientPolBalance();
    
        (bool success, ) = payable(trustedForwarder).call{value: amount}("");
        if (!success) revert PolTransferFailed();

        emit TrustedForwarderFunded(amount);
    }

    function withdrawPol() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoPolToWithdraw();
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert PolTransferFailed();
    }

    // Helper functions
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _msgSender() internal view override returns (address sender) {
        if (msg.sender == trustedForwarder) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return super._msgSender();
        }
    }

    function _msgData() internal view override returns (bytes calldata) {
        if (msg.sender == trustedForwarder) {
            return msg.data[:msg.data.length - 20];
        } else {
            return super._msgData();
        }
    }

    receive() external payable {}
}