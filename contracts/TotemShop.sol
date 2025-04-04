// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { TotemNFT } from "./TotemNFT.sol";
import { TotemGame } from "./TotemGame.sol";
import { TotemToken } from "./TotemToken.sol";

error InvalidGameAddress();
error InvalidTokenAddress();
error InvalidNFTAddress();
error InvalidForwarderAddress();
error BundleNotAvailable();
error BundleExpired();
error InvalidAmount();
error InvalidRarityRange();
error InvalidTokenId();
error TotemNotAvailable();
error InvalidPolCost();
error PolTransferFailed();
error PaymentFailed();
error NotSignedUp();
error AlreadySignedUp();
error NoPolSent();
error InsufficientTokens();
error InvalidSpecies();
error NotTokenOwner();

/**
 * @title TotemShop
 * @dev Handles all purchasing and marketplace functionality for TotemBound
 */
contract TotemShop is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // Data structures
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

    // References to other contracts
    TotemGame public game;
    TotemToken public totemToken;
    TotemNFT public totemNFT;
    address public trustedForwarder;

    // State variables
    mapping(uint256 => Bundle) public bundles;
    uint256 public nextBundleId;
    mapping(uint256 => UnboundTotem) public unboundTotems;
    uint256[] private _unboundTokenIds;

    // Events
    event BundleCreated(uint256 indexed bundleId, Bundle bundle);
    event BundlePurchased(address indexed user, uint256 indexed bundleId, uint256 tokenId, uint256 amount);
    event BundleUpdated(uint256 indexed bundleId, bool enabled, uint256 validUntil);
    event TotemSold(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TotemUnbound(address indexed user, uint256 indexed tokenId, uint256 amount);
    event TotemPurchased(address indexed user, uint256 indexed tokenId, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the shop contract
     * @param _game Address of the TotemGame contract
     * @param _totemToken Address of the TotemToken contract
     * @param _totemNFT Address of the TotemNFT contract
     * @param _trustedForwarder Address of the trusted forwarder for gasless transactions
     */
    function initialize(
        address _game,
        address _totemToken,
        address _totemNFT,
        address _trustedForwarder
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        if (_game == address(0)) revert InvalidGameAddress();
        if (_totemToken == address(0)) revert InvalidTokenAddress();
        if (_totemNFT == address(0)) revert InvalidNFTAddress();
        if (_trustedForwarder == address(0)) revert InvalidForwarderAddress();
        
        game = TotemGame(payable(_game));
        totemToken = TotemToken(_totemToken);
        totemNFT = TotemNFT(_totemNFT);
        trustedForwarder = _trustedForwarder;
    }
    
    /**
     * @dev Allows users to buy TOTEM tokens with POL
     */
    function buyTokens() external payable {
        address user = _msgSender();
        
        // Validate
        if (!game.hasSignedUp(user)) revert NotSignedUp();
        if (msg.value == 0) revert NoPolSent();
        
        // Process token purchase through game
        game.processBuyTokens{value: msg.value}(user);
    }
    
    /**
     * @dev Allows users to purchase a new totem with TOTEM tokens
     * @param speciesId ID of the species to purchase
     * @return tokenId ID of the minted NFT
     */
    function purchaseTotem(uint8 speciesId) external returns (uint256 tokenId) {
        address user = _msgSender();
        
        // Validate
        if (!game.hasSignedUp(user)) revert NotSignedUp();
        if (speciesId >= uint8(TotemNFT.Species.None)) revert InvalidSpecies();
        
        // Get mint price from game
        uint256 mintPrice = game.getTotemPrice();
        
        // Check allowance and balance
        if (totemToken.allowance(user, address(game)) < mintPrice) {
            revert InsufficientTokens();
        }
        
        // Process through game
        tokenId = game.processPurchaseTotem(user, TotemNFT.Species(speciesId));
        
        emit TotemPurchased(user, tokenId, mintPrice);
        
        return tokenId;
    }

    /**
     * @dev Allows users to purchase a bundle
     * @param bundleId ID of the bundle to purchase
     * @return tokenId ID of the minted NFT
     */
    function purchaseBundle(uint256 bundleId) external payable returns (uint256 tokenId) {
        address user = _msgSender();
        
        // Validate bundle
        Bundle storage bundle = bundles[bundleId];
        if (!bundle.enabled) revert BundleNotAvailable();
        if (msg.value != bundle.polCost) revert InvalidAmount();
        if (bundle.validUntil != 0 && block.timestamp > bundle.validUntil) revert BundleExpired();
        
        // Also validate that user is signed up
        if (!game.hasSignedUp(user)) revert NotSignedUp();

        // Call TotemGame to handle the bundle purchase logic
        tokenId = game.processBundlePurchase{value: msg.value}(
            user,
            bundle.tokenAmount,
            bundle.species,
            bundle.color,
            bundle.minRarity,
            bundle.maxRarity,
            bundle.isLimitedRarity
        );

        emit BundlePurchased(user, bundleId, tokenId, msg.value);
        return tokenId;
    }

    /**
     * @dev Allows users to sell a totem back to the marketplace
     * @param tokenId ID of the totem to sell
     */
    function sellTotem(uint256 tokenId) external {
        address user = _msgSender();
        
        // Validate
        if (totemNFT.ownerOf(tokenId) != user) revert NotTokenOwner();
        
        // Call game to process the sell operation and get totem details
        (
            TotemNFT.Species species,
            TotemNFT.Color color,
            TotemNFT.Rarity rarity,
            uint256 happiness,
            uint256 experience,
            uint256 stage,
            string memory displayName,
            uint256 prestigeLevel,
            uint256 sellValue
        ) = game.processSellTotem(user, tokenId);
         
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
        
        emit TotemSold(user, tokenId, sellValue);
    }
    
    /**
     * @dev Allows users to purchase an unbound totem from the marketplace
     * @param tokenId ID of the unbound totem to purchase
     */
    function purchaseUnboundTotem(uint256 tokenId) external {
        address user = _msgSender();
        
        // Validate
        if (!game.hasSignedUp(user)) revert NotSignedUp();
        if (totemNFT.ownerOf(tokenId) != address(game)) revert TotemNotAvailable();
        
        // Validate totem
        UnboundTotem memory totem = unboundTotems[tokenId];
        if (totem.tokenId != tokenId) revert InvalidTokenId();
        
        // Calculate purchase price with +100 fee
        uint256 purchasePrice = totem.sellPrice + 100 * 10**18;
        
        // Check allowance
        if (totemToken.allowance(user, address(game)) < purchasePrice) {
            revert InsufficientTokens();
        }
        
        // Call game to process the purchase
        game.processPurchaseUnboundTotem(user, tokenId, purchasePrice);
        
        // Remove from unbound collections
        delete unboundTotems[tokenId];
        _removeUnboundToken(tokenId);
        
        emit TotemUnbound(user, tokenId, purchasePrice);
    }

    /**
     * @dev Creates a new bundle
     * @param polCost Cost in POL
     * @param tokenAmount Amount of TOTEM tokens included
     * @param species Species of the totem (or None for random)
     * @param color Color of the totem (or None for random)
     * @param minRarity Minimum rarity for random NFTs
     * @param maxRarity Maximum rarity for random NFTs
     * @param isLimitedRarity Whether the NFT should be Limited rarity
     * @param validUntil Expiration timestamp (0 for no expiry)
     * @return bundleId ID of the created bundle
     */
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
        if (polCost <= 0) revert InvalidPolCost();
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
    
    /**
     * @dev Updates an existing bundle
     * @param bundleId ID of the bundle to update
     * @param enabled Whether the bundle is enabled
     * @param validUntil New expiration timestamp
     */
    function updateBundle(
        uint256 bundleId,
        bool enabled,
        uint256 validUntil
    ) external onlyOwner {
        Bundle storage bundle = bundles[bundleId];
        bundle.enabled = enabled;
        bundle.validUntil = validUntil;
        
        emit BundleUpdated(bundleId, enabled, validUntil);
    }

    /**
     * @dev Gets the number of unbound totems in the marketplace
     * @return Count of unbound totems
     */
    function getUnboundTotemCount() external view returns (uint256) {
        return _unboundTokenIds.length;
    }

    /**
     * @dev Gets a list of unbound totem IDs
     * @param offset Starting index
     * @param limit Maximum number of IDs to return
     * @return Array of token IDs
     */
    function getUnboundTokenIds(uint256 offset, uint256 limit) 
        external view returns (uint256[] memory) 
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

    /**
     * @dev Gets detailed information about unbound totems
     * @param offset Starting index
     * @param limit Maximum number of totems to return
     * @return Array of UnboundTotem structs
     */
    function getUnboundTotems(uint256 offset, uint256 limit)
        external view returns (UnboundTotem[] memory)
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

    // Internal helper functions
    function _removeUnboundToken(uint256 tokenId) internal {
        for (uint256 i = 0; i < _unboundTokenIds.length; i++) {
            if (_unboundTokenIds[i] == tokenId) {
                _unboundTokenIds[i] = _unboundTokenIds[_unboundTokenIds.length - 1];
                _unboundTokenIds.pop();
                break;
            }
        }
    }

    // Upgrade authorization
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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