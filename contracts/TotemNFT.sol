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
        Salmon,     // 7
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
        Legendary   // 0.5% - 2 colors
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
        RadiantGold, EtherealSilver,
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
    }

    // Mapping from token ID to attributes
    mapping(uint256 => TotemAttributes) public attributes;
    ITotemAchievements public achievements;
    ITotemRandomOracle public randomOracle;

    // Mapping for complete IPFS hashes: species => color => stage => hash
    mapping(Species => mapping(Color => mapping(uint256 => string))) private _metadataURIs;

    // Mapping to control which colors are valid for each rarity
    mapping(Rarity => mapping(Color => bool)) public validColorForRarity;

    // Experience thresholds for each stage
    uint256[4] public stageThresholds;
    
    // Constants
    bytes32 private constant _COLLECTOR_ACHIEVEMENT_ID = keccak256("collector_progression");
    bytes32 private constant _RARE_COLLECTOR_ACHIEVEMENT_ID = keccak256("rare_collector");
    bytes32 private constant _EPIC_COLLECTOR_ACHIEVEMENT_ID = keccak256("epic_collector");
    bytes32 private constant _LEGENDARY_COLLECTOR_ACHIEVEMENT_ID = keccak256("legendary_collector");
    bytes32 private constant _RARE_EVOLUTION_ACHIEVEMENT_ID = keccak256("rare_evolution");
    bytes32 private constant _EPIC_EVOLUTION_ACHIEVEMENT_ID = keccak256("epic_evolution");
    bytes32 private constant _LEGENDARY_EVOLUTION_ACHIEVEMENT_ID = keccak256("legendary_evolution");

     // Events
    event AttributesUpdated(uint256 indexed tokenId, uint256 happiness, uint256 experience);
    event DisplayNameSet(uint256 indexed tokenId, string newName);
    event TotemEvolved(uint256 indexed tokenId, uint256 newStage, Species species, Rarity rarity);
    event TotemStaked(uint256 indexed tokenId);
    event TotemUnstaked(uint256 indexed tokenId);
    event MetadataURISet(Species species, Color color, uint256 stage, string uri);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("Totem", "TOTEM");
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        // Initialize stages
        stageThresholds =  [500, 1500, 3500, 7500];
    }

    function mint(
        address to, 
        Species species
    ) external onlyOwner returns (uint256) {
        if (species == Species.None) revert InvalidSpecies();
        uint256 tokenId = totalSupply() + 1;
        
        // Request randomness for rarity and color
        uint256 requestId = randomOracle.requestRandomness(2);
        // Get random values
        (bool fulfilled, uint256[] memory randomWords) = randomOracle.getRequestStatus(requestId);
        if (fulfilled == false) revert RandomRequestNotFulfilled();

        // Determine rarity and color
        uint8 rarity = RandomnessHelper.getRarity(randomWords[0]);
        uint8 color = RandomnessHelper.getColorForRarity(randomWords[1], rarity);

        if (Color(color) == Color.None) revert NoValidColorForRarity();

        attributes[tokenId] = TotemAttributes({
            species: species,
            color: Color(color),
            rarity: Rarity(rarity), // Rarity.Common,
            happiness: 50,
            experience: 0,
            stage: 0,
            isStaked: false,
            displayName: ""
        });

        _safeMint(to, tokenId);

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

    function evolve(uint256 tokenId) external {
        address user = msg.sender;
         if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
         if (_ownerOf(tokenId) != user && 
            !isApprovedForAll(_ownerOf(tokenId), user) && 
            getApproved(tokenId) != user) revert NotAuthorizedForToken();

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

            if (totem.stage == 4) {
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

    // Single function to update attributes (called by TotemGame)
    function updateAttributes(
        uint256 tokenId,
        uint256 happinessChange,
        bool isHappinessIncrease,
        uint256 experienceGain
    ) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        
        // Update happiness
        if (isHappinessIncrease) {
            attributes[tokenId].happiness = _min(attributes[tokenId].happiness + happinessChange, 100);
        } else {
            attributes[tokenId].happiness = _max(attributes[tokenId].happiness - happinessChange, 0);
        }
        
        // Update experience
        if (experienceGain > 0) {
            attributes[tokenId].experience += experienceGain;
        }

        emit AttributesUpdated(
            tokenId, 
            attributes[tokenId].happiness,
            attributes[tokenId].experience
        );
    }

    // Set the IPFS hash for a specific species-color-stage combination
    function setMetadataURI(
        Species species,
        Color color,
        uint256 stage,
        string memory ipfsHash
    ) external onlyOwner {
        if (stage > 4) revert InvalidStage();
        if (color == Color.None) revert InvalidColor();
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
            if (stages[i] > 4) revert InvalidStage();
            if (colors[i] == Color.None) revert InvalidColor();
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

    function setDisplayName(uint256 tokenId, string memory newName) external {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (_ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
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
}