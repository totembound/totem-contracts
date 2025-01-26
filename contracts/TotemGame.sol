// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./TotemToken.sol";
import "./TotemNFT.sol";

contract TotemGame is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    TotemToken public totemToken;
    TotemNFT public totemNFT;
    address public trustedForwarder;
    mapping(address => bool) public hasSignedUp;

    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // Constants
    uint256 public constant SIGNUP_REWARD = 2_000 * 10**18;  // 2000 TOTEM
    uint256 public constant MINT_PRICE = 500 * 10**18;       // 500 TOTEM
    uint256 public constant FEED_COST = 10 * 10**18;         // 10 TOTEM
    uint256 public constant TRAIN_COST = 20 * 10**18;        // 20 TOTEM
    uint256 public constant FEED_HAPPINESS_INCREASE = 10;
    uint256 public constant TRAIN_EXPERIENCE_INCREASE = 50;
    uint256 public constant TRAIN_HAPPINESS_DECREASE = 10;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant WINDOW_1_START = 0;     // 00:00 UTC
    uint256 public constant WINDOW_2_START = 28800; // 08:00 UTC
    uint256 public constant WINDOW_3_START = 57600; // 16:00 UTC

    // Updated events
    event UserSignedUp(address indexed user);
    event TotemPurchased(address indexed user, uint256 indexed tokenId, TotemNFT.Species species);
    event TotemFed(uint256 indexed tokenId);
    event TotemTrained(uint256 indexed tokenId);
    event ForwarderFunded(uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _totemToken,
        address _totemNFT,
        address _trustedForwarder
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        totemToken = TotemToken(_totemToken);
        totemNFT = TotemNFT(_totemNFT);
        trustedForwarder = _trustedForwarder;
    }

    function signup() external {
        address user = _msgSender();
        require(!hasSignedUp[user], "Already signed up");
        
        // Mark as signed up and give initial tokens
        hasSignedUp[user] = true;
        totemToken.transfer(user, SIGNUP_REWARD); // 2000 TOTEM

        emit UserSignedUp(user);
    }

    function buyTokens() external payable {
        address user = _msgSender();
        require(hasSignedUp[user], "Must sign up first");
        require(msg.value > 0, "Must send POL");
        
        // Calculate token amount based on sent POL
        uint256 tokenAmount = (msg.value * 10**18) / totemToken.TOKEN_PRICE();
        
        // Ensure sufficient tokens in contract
        require(totemToken.balanceOf(address(this)) >= tokenAmount, "Insufficient tokens available");
        
        // Transfer tokens to user
        totemToken.transfer(user, tokenAmount);
        
        // Optional: Forward received POL to a specific address
        (bool sent, ) = payable(owner()).call{value: msg.value}("");
        require(sent, "Failed to forward POL");
    }

    // This is where users spend TOTEM to get their NFT
    function purchaseTotem(uint8 speciesId) external {
        require(hasSignedUp[_msgSender()], "Must sign up first");
        require(speciesId < uint8(TotemNFT.Species.None), "Invalid species");
        
        // Take payment for the totem
        require(totemToken.transferFrom(_msgSender(), address(this), MINT_PRICE), "Purchase failed");
        
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
        if (currentDaySeconds < WINDOW_2_START) {
            // Window 1: 00:00-08:00
            return lastFedDaySeconds >= WINDOW_2_START || lastFedDaySeconds < WINDOW_1_START;
        } else if (currentDaySeconds < WINDOW_3_START) {
            // Window 2: 08:00-16:00
            return lastFedDaySeconds < WINDOW_2_START || lastFedDaySeconds >= WINDOW_3_START;
        } else {
            // Window 3: 16:00-24:00
            return lastFedDaySeconds < WINDOW_3_START;
        }
    }

    function feed(uint256 tokenId) external {
        require(totemNFT.ownerOf(tokenId) == _msgSender(), "Not owner");
        
        // Only destructure the lastFed value we need
        (, , , , , ,uint256 lastFed, ,) = totemNFT.attributes(tokenId);

        require(_canFeed(lastFed), "Too soon to feed");

        totemToken.transferFrom(_msgSender(), address(this), FEED_COST);
        totemNFT.updateHappiness(tokenId, FEED_HAPPINESS_INCREASE, true);
        totemNFT.updateLastFed(tokenId);
        
        emit TotemFed(tokenId);
    }

    function train(uint256 tokenId) external {
        require(totemNFT.ownerOf(tokenId) == _msgSender(), "Not owner");
        
        totemToken.transferFrom(_msgSender(), address(this), TRAIN_COST);
        totemNFT.addExperience(tokenId, TRAIN_EXPERIENCE_INCREASE);
        totemNFT.updateHappiness(tokenId, TRAIN_HAPPINESS_DECREASE, false);
        
        emit TotemTrained(tokenId);
    }

    function fundForwarder(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient POL balance");
        
        (bool success, ) = payable(trustedForwarder).call{value: amount}("");
        require(success, "POL transfer failed");
        
        emit ForwarderFunded(amount);
    }

    function withdrawPol() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No POL to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "POL transfer failed");
    }

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