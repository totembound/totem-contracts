// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./TotemToken.sol";
import "./TotemNFT.sol";

contract TotemGame is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    struct GameParameters {
        uint256 signupReward;
        uint256 mintPrice;
        uint256 feedCost;
        uint256 trainCost;
        uint256 feedHappinessIncrease;
        uint256 trainExperienceIncrease;
        uint256 trainHappinessDecrease;
    }

    struct TimeWindows {
        uint256 window1Start;
        uint256 window2Start;
        uint256 window3Start;
    }

    TotemToken public totemToken;
    TotemNFT public totemNFT;
    address public trustedForwarder;
    GameParameters public gameParams;
    TimeWindows public timeWindows;
    mapping(address => bool) public hasSignedUp;

    event GameParametersUpdated(GameParameters params);
    event TimeWindowsUpdated(TimeWindows windows);
    event UserSignedUp(address indexed user);
    event TotemPurchased(address indexed user, uint256 indexed tokenId, TotemNFT.Species species);
    event TotemFed(uint256 indexed tokenId);
    event TotemTrained(uint256 indexed tokenId);
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
    }

    function signup() external {
        address user = _msgSender();
        require(!hasSignedUp[user], "Already signed up");
        
        // Mark as signed up and give initial tokens
        hasSignedUp[user] = true;
        totemToken.transfer(user, gameParams.signupReward);

        emit UserSignedUp(user);
    }

    function buyTokens() external payable {
        address user = _msgSender();
        require(hasSignedUp[user], "Must sign up first");
        require(msg.value > 0, "Must send POL");
        
        // Calculate token amount based on sent POL
        uint256 tokenAmount = (msg.value * 10**18) / totemToken.getTokenPrice();
        
        // Ensure sufficient tokens in contract
        require(totemToken.balanceOf(address(this)) >= tokenAmount, "Insufficient tokens available");
        
        // Transfer tokens to user
        totemToken.transfer(user, tokenAmount);
        
        // Forward received POL to a specific address
        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        require(sent, "Failed to forward POL");
    }

    // This is where users spend TOTEM to get their NFT
    function purchaseTotem(uint8 speciesId) external {
        require(hasSignedUp[_msgSender()], "Must sign up first");
        require(speciesId < uint8(TotemNFT.Species.None), "Invalid species");
        
        // Take payment for the totem
        require(totemToken.transferFrom(_msgSender(), address(this), gameParams.mintPrice), "Purchase failed");
        
        // Mint their chosen totem
        // For now, all mints are Common rarity
        uint256 tokenId = totemNFT.mint(_msgSender(), TotemNFT.Species(speciesId), TotemNFT.Rarity.Common);
        
        emit TotemPurchased(_msgSender(), tokenId, TotemNFT.Species(speciesId));
    }

    function hasAccount(address user) external view returns(bool)
    {
        return hasSignedUp[user];
    }

    function _canFeed(uint256 lastFed) internal view returns (bool) {
        uint256 timestamp = block.timestamp;
        
        // Get day timestamps
        uint256 todayUTC = (timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
        uint256 lastFedDay = (lastFed / SECONDS_PER_DAY) * SECONDS_PER_DAY;
        
        // If different day, allow feeding
        if (todayUTC > lastFedDay) return true;
        
        // Get seconds into current day
        uint256 currentDaySeconds = timestamp - todayUTC;
        uint256 lastFedDaySeconds = lastFed - lastFedDay;
        
        // Check if in different window
        if (currentDaySeconds < timeWindows.window2Start) {
            // Window 1: 00:00-08:00
            return lastFedDaySeconds >= timeWindows.window2Start || lastFedDaySeconds < timeWindows.window1Start;
        } else if (currentDaySeconds < timeWindows.window3Start) {
            // Window 2: 08:00-16:00
            return lastFedDaySeconds < timeWindows.window2Start || lastFedDaySeconds >= timeWindows.window3Start;
        } else {
            // Window 3: 16:00-24:00
            return lastFedDaySeconds < timeWindows.window3Start;
        }
    }

    function feed(uint256 tokenId) external {
        require(totemNFT.ownerOf(tokenId) == _msgSender(), "Not owner");
        
        // Only destructure the lastFed value we need
        (, , , , , ,uint256 lastFed, ,) = totemNFT.attributes(tokenId);

        require(_canFeed(lastFed), "Too soon to feed");

        totemToken.transferFrom(_msgSender(), address(this), gameParams.feedCost);
        totemNFT.updateHappiness(tokenId, gameParams.feedHappinessIncrease, true);
        totemNFT.updateLastFed(tokenId);
        
        emit TotemFed(tokenId);
    }

    function train(uint256 tokenId) external {
        require(totemNFT.ownerOf(tokenId) == _msgSender(), "Not owner");
        
        totemToken.transferFrom(_msgSender(), address(this), gameParams.trainCost);
        totemNFT.addExperience(tokenId, gameParams.trainExperienceIncrease);
        totemNFT.updateHappiness(tokenId, gameParams.trainHappinessDecrease, false);
        
        emit TotemTrained(tokenId);
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

    function setNFTMetadataURIs(
        TotemNFT.Species[] calldata species,
        TotemNFT.Color[] calldata colors,
        uint256[] calldata stages,
        string[] calldata ipfsHashes
    ) external onlyOwner {
        totemNFT.batchSetMetadataURIs(species, colors, stages, ipfsHashes);
    }

    function updateGameParameters(GameParameters memory _params) external onlyOwner {
        require(_params.signupReward > 0, "Invalid signup reward");
        require(_params.mintPrice > 0, "Invalid mint price");
        require(_params.feedCost > 0, "Invalid feed cost");
        require(_params.trainCost > 0, "Invalid train cost");
        
        gameParams = _params;
        emit GameParametersUpdated(_params);
    }

    function updateTimeWindows(TimeWindows memory _windows) external onlyOwner {
        require(_windows.window1Start < _windows.window2Start, "Invalid window 1");
        require(_windows.window2Start < _windows.window3Start, "Invalid window 2");
        require(_windows.window3Start < SECONDS_PER_DAY, "Invalid window 3");
        
        timeWindows = _windows;
        emit TimeWindowsUpdated(_windows);
    }

    function updateTrustedForwarder(address _newForwarder) external onlyOwner {
        require(_newForwarder != address(0), "Invalid forwarder address");
        trustedForwarder = _newForwarder;
        emit TrustedForwarderUpdated(_newForwarder);
    }
    function fundTrustedForwarder(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient POL balance");
        
        (bool success, ) = payable(trustedForwarder).call{value: amount}("");
        require(success, "POL transfer failed");
        
        emit TrustedForwarderFunded(amount);
    }

    function withdrawPol() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No POL to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "POL transfer failed");
    }

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