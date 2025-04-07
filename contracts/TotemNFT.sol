// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC721EnumerableUpgradeable } 
    from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { RandomnessHelper } from "./helpers/RandomnessHelper.sol";
import { ITotemRandomOracle } from "./interfaces/ITotemRandomOracle.sol";
import { ITotemAchievements } from "./interfaces/ITotemAchievements.sol";

error InvalidSpecies();
error NoValidColorForRarity();
error TokenDoesNotExist();
error NotAuthorizedForToken();
error MaxStageReached();
error InsufficientExperience();
error EvolutionMetadataNotSet();
error InvalidStage();
error InvalidColor();
error ArrayLengthMismatch();
error NotTokenOwner();
error InvalidNameFormat();
error InvalidUTF8();
error URINotSet();
error InvalidAddress();
error RandomRequestNotFulfilled();
error InvalidRarityRange();
error InvalidForwarderAddress();

contract TotemNFT is 
    Initializable, 
    ERC721EnumerableUpgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable 
{
    using RandomnessHelper for uint256;

    enum Species {
        Goose,      // 0
        Otter,      // 1
        Wolf,       // 2
        Falcon,     // 3
        Beaver,     // 4
        Deer,       // 5
        Woodpecker, // 6
        Turtle,     // 7
        Bear,       // 8
        Raven,      // 9
        Snake,      // 10
        Owl,        // 11
        None        // For validation
    }

    enum Rarity {
        Common,     // 75%  - 4 colors
        Uncommon,   // 15%  - 4 colors
        Rare,       // 7%   - 3 colors
        Epic,       // 2.5% - 3 colors
        Legendary,  // 0.5% - 2 colors
        Limited     // Event/Bundle only
    }

    enum Color {
        // Common Colors
        Brown, Gray, White, Tawny,
        // Uncommon Colors
        Slate, Copper, Cream, Dappled,
        // Rare Colors
        Golden, DarkPurple, Charcoal,
        // Epic Colors
        EmeraldGreen, CrimsonRed, DeepSapphire,
        // Legendary Colors
        EtherealSilver, RadiantGold,
        // Limited Colors
        FrostbiteBlue, RosyPink, VerdantGold, RaindropTeal,
        FloralViolet, SunsetOrange, EmberRed, OceanicAzure,
        HarvestGold, PhantomBlack, EmberwoodBrown, StarlitSilver,
        None
    }

    struct TotemAttributes {
        Species species;
        Color color;
        Rarity rarity;
        uint256 happiness;
        uint256 experience;
        uint256 stage;      // 0 (Egg/Pup) to 4 (Elder)
        bool isStaked;      // For stage 4 staking
        string displayName;
        uint256 prestigeLevel;
    }

    // Mapping from token ID to attributes
    mapping(uint256 => TotemAttributes) public attributes;
    ITotemAchievements public achievements;
    ITotemRandomOracle public randomOracle;
    // Experience thresholds for each stage
    uint256[4] public stageThresholds;
    uint256 public prestigeXpThreshold;
    uint256 public prestigeXpThresholdLevels;
    // Mapping to control which colors are valid for each rarity
    mapping(Rarity => mapping(Color => bool)) public validColorForRarity;
    address public trustedForwarder;

    // Mapping for complete IPFS hashes: species => color => stage => hash
    mapping(Species => mapping(Color => mapping(uint256 => string))) private _metadataURIs;
    mapping(address => mapping(bytes32 => bool)) private _specialVariantOwned;
    uint256 private _nextTokenId;

    // Constants
    uint256 private constant _MAX_STAGE = 4;
    bytes32 private constant _COLLECTOR_ACHIEVEMENT_ID = keccak256("collector_progression");
    bytes32 private constant _RARE_COLLECTOR_ACHIEVEMENT_ID = keccak256("rare_collector");
    bytes32 private constant _EPIC_COLLECTOR_ACHIEVEMENT_ID = keccak256("epic_collector");
    bytes32 private constant _LEGENDARY_COLLECTOR_ACHIEVEMENT_ID = keccak256("legendary_collector");
    bytes32 private constant _SEASONAL_COLLECTOR_ACHIEVEMENT_ID = keccak256("seasonal_collector");
    bytes32 private constant _RARE_EVOLUTION_ACHIEVEMENT_ID = keccak256("rare_evolution");
    bytes32 private constant _EPIC_EVOLUTION_ACHIEVEMENT_ID = keccak256("epic_evolution");
    bytes32 private constant _LEGENDARY_EVOLUTION_ACHIEVEMENT_ID = keccak256("legendary_evolution");
    bytes32 private constant _PRESTIGE_EVOLUTION_ACHIEVEMENT_ID = keccak256("prestige_progression");

     // Events
    event AttributesUpdated(uint256 indexed tokenId, uint256 happiness, uint256 experience);
    event DisplayNameSet(uint256 indexed tokenId, string newName);
    event TotemEvolved(uint256 indexed tokenId, uint256 newStage, Species species, Rarity rarity);
    event TotemStaked(uint256 indexed tokenId);
    event TotemUnstaked(uint256 indexed tokenId);
    event MetadataURISet(Species species, Color color, uint256 stage, string uri);
    event PrestigeLevelReached(uint256 indexed tokenId, uint256 prestigeLevel);
    event TrustedForwarderUpdated(address newForwarder);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _trustedForwarder
    ) public initializer {
        __ERC721_init("Totem", "TOTEM");
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        // Initialize stages
        stageThresholds =  [500, 1500, 3500, 7500];
        prestigeXpThreshold = 7500;
        prestigeXpThresholdLevels = 2500;
        // Set trusted forwarder
        if (_trustedForwarder == address(0)) revert InvalidForwarderAddress();
        trustedForwarder = _trustedForwarder;
    }

    function mint(
        address to, 
        Species species
    ) external onlyOwner returns (uint256) {
        if (species == Species.None) revert InvalidSpecies();

         // Get next token ID atomically
        uint256 tokenId = _getNextTokenId();
        
        // Request randomness for rarity and color
        uint256 requestId = randomOracle.requestRandomness(1);

        // Get random value
        (bool fulfilled, uint256[] memory randomWords) = randomOracle.getRequestStatus(requestId);
        if (fulfilled == false) revert RandomRequestNotFulfilled();

        // Determine both rarity and color from a single random number
        (uint8 rarity, uint8 color) = RandomnessHelper.getRarityAndColor(randomWords[0]);

        if (Color(color) == Color.None) revert NoValidColorForRarity();

        _safeMint(to, tokenId); // Mint before setting attributes
        
        attributes[tokenId] = TotemAttributes({
            species: species,
            color: Color(color),
            rarity: Rarity(rarity),
            happiness: 50,
            experience: 0,
            stage: 0,
            isStaked: false,
            displayName: "",
            prestigeLevel: 0
        });

        // Check for achievements
        if (address(achievements) != address(0)) {
            achievements.updateProgress(_COLLECTOR_ACHIEVEMENT_ID, to, 1);

            if (rarity == uint8(Rarity.Rare)) {
                achievements.unlockAchievement(_RARE_COLLECTOR_ACHIEVEMENT_ID, to);
            }
            else if (rarity == uint8(Rarity.Epic)) {
                achievements.unlockAchievement(_EPIC_COLLECTOR_ACHIEVEMENT_ID, to);
            }
            else if (rarity == uint8(Rarity.Legendary)) {
                achievements.unlockAchievement(_LEGENDARY_COLLECTOR_ACHIEVEMENT_ID, to);
            }
        }

        return tokenId;
    }

    function mintWithRarity(
        address to,
        Species species,
        Rarity minRarity,
        Rarity maxRarity
    ) external onlyOwner returns (uint256) {
        if (species == Species.None) revert InvalidSpecies();
        if (minRarity > maxRarity) revert InvalidRarityRange();

        uint256 tokenId = _getNextTokenId();

        // Request randomness for rarity and color selection
        uint256 requestId = randomOracle.requestRandomness(1);
        (bool fulfilled, uint256[] memory randomWords) = randomOracle.getRequestStatus(requestId);
        if (!fulfilled) revert RandomRequestNotFulfilled();

        // Get rarity within range if specified
        uint8 rarity;
        uint8 color;
        
        if (minRarity == maxRarity) {
            rarity = uint8(minRarity);
             // Use randomness to determine color only
            color = RandomnessHelper.getColorForRarity(randomWords[0], rarity);
        } else {
            // Calculate rarity within range
            uint256 rarityRange = uint256(maxRarity) - uint256(minRarity) + 1;
            uint256 randomRarity = uint256(minRarity) + (randomWords[0] % rarityRange);
            rarity = uint8(randomRarity);
            
            // Use a different part of the randomness for color
            color = RandomnessHelper.getColorForRarity(randomWords[0] >> 10, rarity);
        }

        if (Color(color) == Color.None) revert NoValidColorForRarity();

        _safeMint(to, tokenId);

        attributes[tokenId] = TotemAttributes({
            species: species,
            color: Color(color),
            rarity: Rarity(rarity),
            happiness: 50,
            experience: 0,
            stage: 0,
            isStaked: false,
            displayName: "",
            prestigeLevel: 0
        });

        // Check for achievements
        if (address(achievements) != address(0)) {
            achievements.updateProgress(_COLLECTOR_ACHIEVEMENT_ID, to, 1);

            if (rarity == uint8(Rarity.Rare)) {
                achievements.unlockAchievement(_RARE_COLLECTOR_ACHIEVEMENT_ID, to);
            }
            else if (rarity == uint8(Rarity.Epic)) {
                achievements.unlockAchievement(_EPIC_COLLECTOR_ACHIEVEMENT_ID, to);
            }
            else if (rarity == uint8(Rarity.Legendary)) {
                achievements.unlockAchievement(_LEGENDARY_COLLECTOR_ACHIEVEMENT_ID, to);
            }
        }

        return tokenId;
    }

    function mintLimited(
        address to,
        Species species,
        Color color,
        Rarity rarity
    ) external onlyOwner returns (uint256) {
        if (species == Species.None) revert InvalidSpecies();
        if (color == Color.None) revert InvalidColor();

        uint256 tokenId = _getNextTokenId();

        _safeMint(to, tokenId);

        attributes[tokenId] = TotemAttributes({
            species: species,
            color: color,
            rarity: rarity,
            happiness: 50,
            experience: 0,
            stage: 0,
            isStaked: false,
            displayName: "",
            prestigeLevel: 0
        });
        
        // Check if user already owns this special variant
        bytes32 variantHash = _getLimitedVariantHash(species, color, rarity);

        // Check for achievements
        if (address(achievements) != address(0)) {
            achievements.updateProgress(_COLLECTOR_ACHIEVEMENT_ID, to, 1);

            // Check if user already owns this special variant
            if (!_specialVariantOwned[to][variantHash]) {
                achievements.updateProgress(_SEASONAL_COLLECTOR_ACHIEVEMENT_ID, to, 1);
            }
        }

        // Mark this variant as owned
        _specialVariantOwned[to][variantHash] = true;

        return tokenId;
    }

    function evolve(uint256 tokenId) external {
        address user = _msgSender();
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();

        // Allow token owner or approved addresses
        if (_ownerOf(tokenId) != user && 
            !isApprovedForAll(_ownerOf(tokenId), user) && 
            getApproved(tokenId) != user) {
            revert NotAuthorizedForToken();
        }

        TotemAttributes storage totem = attributes[tokenId];
        if (totem.stage >= 4) revert MaxStageReached();
        
        uint256 requiredExp = stageThresholds[totem.stage];
        if (totem.experience < requiredExp) revert InsufficientExperience();
        
        totem.stage += 1;
        
        // Verify the metadata URI exists for the new stage
        if (bytes(_metadataURIs[totem.species][totem.color][totem.stage]).length == 0) {
            revert EvolutionMetadataNotSet();
        }

        if (address(achievements) != address(0)) {
            // Progress on evolution stages
            achievements.updateEvolutionProgress(user, totem.stage);

            if (totem.stage == _MAX_STAGE) {
                if (totem.rarity == Rarity.Rare) {
                    achievements.unlockAchievement(_RARE_EVOLUTION_ACHIEVEMENT_ID, user);
                }
                else if (totem.rarity == Rarity.Epic) {
                    achievements.unlockAchievement(_EPIC_EVOLUTION_ACHIEVEMENT_ID, user);
                }
                else if (totem.rarity == Rarity.Legendary) {
                    achievements.unlockAchievement(_LEGENDARY_EVOLUTION_ACHIEVEMENT_ID, user);
                }
            }
        }

        emit TotemEvolved(tokenId, totem.stage, totem.species, totem.rarity);
    }

    function burn(uint256 tokenId) external {
        address user = _msgSender();
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        address tokenOwner = _ownerOf(tokenId);
        
        // Check if caller is either:
        // 1. The contract owner (TotemGame)
        // 2. The token owner
        // 3. An approved operator
        if (user != owner()) {
            if (
                tokenOwner != user && 
                !isApprovedForAll(tokenOwner, user) && 
                getApproved(tokenId) != user
            ) revert NotAuthorizedForToken();
        }

        // Remove the attributes
        delete attributes[tokenId];

        // Perform the burn
        _burn(tokenId);
    }

    // Single function to update attributes (called by TotemGame)
    function updateAttributes(
        uint256 tokenId,
        uint256 happinessChange,
        bool isHappinessIncrease,
        uint256 experienceGain
    ) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        
        TotemAttributes storage totem = attributes[tokenId];

        // Store the previous prestige level before modifications
        uint256 previousPrestigeLevel = totem.prestigeLevel;
        address tokenOwner = _ownerOf(tokenId);

        // Update happiness
        if (isHappinessIncrease) {
            totem.happiness = _min(totem.happiness + happinessChange, 100);
        } else {
            totem.happiness = _max(totem.happiness - happinessChange, 0);
        }
        
        // Update experience and handle prestige
        if (experienceGain > 0) {
            totem.experience += experienceGain;

             // Check for prestige levels after max stage
            if (totem.stage == _MAX_STAGE && totem.experience >= prestigeXpThreshold) {
                uint256 currentPrestigeLevel = (totem.experience - prestigeXpThreshold) / prestigeXpThresholdLevels;

                // Only update and emit if prestige level has changed
                if (currentPrestigeLevel > previousPrestigeLevel) {
                    totem.prestigeLevel = currentPrestigeLevel;

                    // Trigger achievements if prestige level increased
                    if (address(achievements) != address(0)) {
                        // Update progress for prestige achievement
                        achievements.updateProgress(_PRESTIGE_EVOLUTION_ACHIEVEMENT_ID, tokenOwner, 1);
                        
                        // Emit the event
                        emit PrestigeLevelReached(tokenId, totem.prestigeLevel);
                    }
                }
            }
        }

        emit AttributesUpdated(
            tokenId, 
            attributes[tokenId].happiness,
            attributes[tokenId].experience
        );
    }

    function updateTrustedForwarder(address _newForwarder) external onlyOwner {
        if (_newForwarder == address(0)) revert InvalidForwarderAddress();
        trustedForwarder = _newForwarder;
        emit TrustedForwarderUpdated(_newForwarder);
    }

    // Set the IPFS hash for a specific species-color-stage combination
    function setMetadataURI(
        Species species,
        Color color,
        uint256 stage,
        string memory ipfsHash
    ) external onlyOwner {
        if (uint8(species) >= uint8(Species.None)) revert InvalidSpecies();
        if (stage > 4) revert InvalidStage();
        if (uint8(color) >= uint8(Color.None)) revert InvalidColor();

        _metadataURIs[species][color][stage] = ipfsHash;
        emit MetadataURISet(species, color, stage, ipfsHash);
    }

    function setAchievements(address _achievements) external onlyOwner {
        if (_achievements == address(0)) revert InvalidAddress();
        achievements = ITotemAchievements(_achievements);
    }

    function setRandomOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert InvalidAddress();
        randomOracle = ITotemRandomOracle(_oracle);
    }

    // Batch set metadata URIs for efficiency
    function batchSetMetadataURIs(
        Species[] calldata species,
        Color[] calldata colors,
        uint256[] calldata stages,
        string[] calldata ipfsHashes
    ) external onlyOwner {
        if (species.length != colors.length ||
            colors.length != stages.length ||
            stages.length != ipfsHashes.length) revert ArrayLengthMismatch();
        
        for(uint256 i = 0; i < species.length; i++) {
            if (uint8(species[i]) >= uint8(Species.None)) revert InvalidSpecies();
            if (stages[i] > 4) revert InvalidStage();
            if (uint8(colors[i]) >= uint8(Color.None)) revert InvalidColor();

            _metadataURIs[species[i]][colors[i]][stages[i]] = ipfsHashes[i];
            emit MetadataURISet(species[i], colors[i], stages[i], ipfsHashes[i]);
        }
    }

    function setValidColorsForRarities(uint256[] calldata rarities, uint256[] calldata colors) external onlyOwner {
        if (rarities.length != colors.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < rarities.length; i++) {
            validColorForRarity[Rarity(rarities[i])][Color(colors[i])] = true;
        }
    }

    function setStageThresholds(uint256[4] calldata newThresholds) external onlyOwner {
        stageThresholds = newThresholds;
    }

    function setPrestigeXpThreshold(uint256 newXpThreshold) external onlyOwner {
        prestigeXpThreshold = newXpThreshold;
    }

    function setPrestigeXpThresholdLevels(uint256 newXpThresholdLevels) external onlyOwner {
        prestigeXpThresholdLevels = newXpThresholdLevels;
    }

    function gameTransferFrom(address from, address to, uint256 tokenId) external onlyOwner {
        _transfer(from, to, tokenId);
    }

    function setDisplayName(uint256 tokenId, string memory newName) external {
        address user = _msgSender();
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (_ownerOf(tokenId) != user) revert NotTokenOwner();
        if (!_validateDisplayName(newName)) revert InvalidNameFormat();
        
        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function forceUpdateDisplayName(uint256 tokenId, string memory newName) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (!_validateDisplayName(newName)) revert InvalidNameFormat();

        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function tokensOfOwner(address user) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(user);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for(uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(user, i);
        }
        
        return tokens;
    }

    function getPrestigeInfo(uint256 tokenId) external view returns (
        uint256 prestigeLevel,
        uint256 nextPrestigeXP
    ) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        
        TotemAttributes storage totem = attributes[tokenId];
        
        if (totem.stage < _MAX_STAGE) {
            return (0, 0);
        }
        
        prestigeLevel = totem.prestigeLevel;
        nextPrestigeXP = prestigeXpThreshold + (prestigeLevel + 1) * prestigeXpThresholdLevels;
        
        return (prestigeLevel, nextPrestigeXP);
    }

    // View function to get URI directly (for frontend)
    function getMetadataURI(
        Species species,
        Color color,
        uint256 stage
    ) external view returns (string memory) {
        if (uint8(species) >= uint8(Species.None)) revert InvalidSpecies();
        if (uint8(color) >= uint8(Color.None)) revert InvalidColor();
        if (stage > 4) revert InvalidStage();

        string memory hash = _metadataURIs[species][color][stage];
        if (bytes(hash).length == 0) revert URINotSet();

        return string(abi.encodePacked("ipfs://", hash));
    }
    
    function getSpeciesBaseStats(
        Species species,
        Rarity rarity
    ) external pure returns (
        uint256 strength,
        uint256 agility,
        uint256 wisdom
    ) {
        // Calculate rarity bonus: Epic/Limited +1, Legendary +2, others +0
        uint256 bonus = rarity == Rarity.Epic || rarity == Rarity.Limited ? 1 : 
                (rarity == Rarity.Legendary ? 2 : 0);

        // Set base stats according to species
        if (species == Species.Bear) {
            return (12 + bonus, 5 + bonus, 7 + bonus);  // Strength primary
        }
        else if (species == Species.Wolf) {
            return (11 + bonus, 8 + bonus, 5 + bonus);  // Strength primary
        }
        else if (species == Species.Beaver) {
            return (10 + bonus, 5 + bonus, 9 + bonus);  // Strength primary
        }
        else if (species == Species.Turtle) {
            return (10 + bonus, 8 + bonus, 6 + bonus);  // Strength primary
        }
        else if (species == Species.Owl) {
            return (5 + bonus, 7 + bonus, 12 + bonus);  // Wisdom primary
        }
        else if (species == Species.Raven) {
            return (5 + bonus, 8 + bonus, 11 + bonus);  // Wisdom primary
        }
        else if (species == Species.Goose) {
            return (8 + bonus, 6 + bonus, 10 + bonus);  // Wisdom primary
        }
        else if (species == Species.Snake) {
            return (7 + bonus, 6 + bonus, 11 + bonus);  // Wisdom primary
        }
        else if (species == Species.Falcon) {
            return (5 + bonus, 12 + bonus, 7 + bonus);  // Agility primary
        }
        else if (species == Species.Deer) {
            return (5 + bonus, 11 + bonus, 8 + bonus);  // Agility primary
        }
        else if (species == Species.Otter) {
            return (8 + bonus, 10 + bonus, 6 + bonus);  // Agility primary
        }
        else if (species == Species.Woodpecker) {
            return (7 + bonus, 11 + bonus, 6 + bonus);  // Agility primary
        }
        
        // Default case for Species.None or any unhandled species
        return (0, 0, 0);
    }

    // Get the complete URI for a token
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TotemAttributes memory totem = attributes[tokenId];
        
        string memory hash = _metadataURIs[totem.species][totem.color][totem.stage];
        if (bytes(hash).length == 0) revert URINotSet();
        
        return string(abi.encodePacked("ipfs://", hash));
    }

    // Marketplace Compatibility Functions
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(ERC721EnumerableUpgradeable) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    // Helper functions
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

    function _getLimitedVariantHash(
        Species species,
        Color color,
        Rarity rarity
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(species, color, rarity));
    }

    function _validateDisplayName(string memory str) internal pure returns (bool) {
        bytes memory b = bytes(str);
        if (b.length < 1 || b.length > 32) return false;
        // Basic emoji range + alphanumeric + basic punctuation
        for(uint256 i; i<b.length; i++){
            bytes1 char = b[i];
            if(uint8(char) >= 0xF0) return false; // Block 4-byte UTF8
        }
        return true;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    // Upgrade authorization
    // solhint-disable-next-line
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _getNextTokenId() private returns (uint256) {
        unchecked {
            _nextTokenId += 1;  // Increment first
            return _nextTokenId; // Return new value
        }
    }
}