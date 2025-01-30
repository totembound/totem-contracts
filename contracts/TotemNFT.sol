// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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

contract TotemNFT is ERC721Enumerable, Ownable {
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
        Common,     // 75%  - 5 colors
        Uncommon,   // 15%  - 5 colors
        Rare,       // 7%   - 4 colors
        Epic,       // 2.5% - 3 colors
        Legendary   // 0.5% - 2 colors
    }

    enum Color {
        // Common Colors
        Brown, Gray, White, Tawny, Speckled,
        // Uncommon Colors
        Russet, Slate, Copper, Cream, Dappled,
        // Rare Colors
        Golden, DarkPurple, LightBlue, Charcoal,
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

    // Mapping for complete IPFS hashes: species => color => stage => hash
    mapping(Species => mapping(Color => mapping(uint256 => string))) private _metadataURIs;

    // Mapping to control which colors are valid for each rarity
    mapping(Rarity => mapping(Color => bool)) public validColorForRarity;

    // Experience thresholds for each stage
    uint256[4] public stageThresholds = [500, 1500, 3500, 7500];
    
     // Events
    event AttributesUpdated(uint256 indexed tokenId, uint256 happiness, uint256 experience);
    event DisplayNameSet(uint256 indexed tokenId, string newName);
    event TotemEvolved(uint256 indexed tokenId, uint256 newStage, Species species, Rarity rarity);
    event TotemStaked(uint256 indexed tokenId);
    event TotemUnstaked(uint256 indexed tokenId);
    event MetadataURISet(Species species, Color color, uint256 stage, string uri);

    constructor() ERC721("Totem", "TOTEM") Ownable(msg.sender) {
        // Initialize valid colors for each rarity
        // Common
        validColorForRarity[Rarity.Common][Color.Brown] = true;
        validColorForRarity[Rarity.Common][Color.Gray] = true;
        validColorForRarity[Rarity.Common][Color.White] = true;
        validColorForRarity[Rarity.Common][Color.Tawny] = true;
        validColorForRarity[Rarity.Common][Color.Speckled] = true;
        // Uncommon
        validColorForRarity[Rarity.Uncommon][Color.Russet] = true;
        validColorForRarity[Rarity.Uncommon][Color.Slate] = true;
        validColorForRarity[Rarity.Uncommon][Color.Copper] = true;
        validColorForRarity[Rarity.Uncommon][Color.Cream] = true;
        validColorForRarity[Rarity.Uncommon][Color.Dappled] = true;
        // Rare
        validColorForRarity[Rarity.Rare][Color.Golden] = true;
        validColorForRarity[Rarity.Rare][Color.DarkPurple] = true;
        validColorForRarity[Rarity.Rare][Color.LightBlue] = true;
        validColorForRarity[Rarity.Rare][Color.Charcoal] = true;
        // Epic
        validColorForRarity[Rarity.Epic][Color.EmeraldGreen] = true;
        validColorForRarity[Rarity.Epic][Color.CrimsonRed] = true;
        validColorForRarity[Rarity.Epic][Color.DeepSapphire] = true;
        // Legendary
        validColorForRarity[Rarity.Legendary][Color.RadiantGold] = true;
        validColorForRarity[Rarity.Legendary][Color.EtherealSilver] = true;
    }

    function mint(
        address to, 
        Species species,
        Rarity rarity
    ) external onlyOwner returns (uint256) {
        if (species == Species.None) revert InvalidSpecies();
        uint256 tokenId = totalSupply() + 1;
        
        // For now, all mints are Common rarity
        rarity = Rarity.Common;

        // Assign a valid color for this rarity
        Color color = getValidColorForRarity(rarity);
        if (color == Color.None) revert NoValidColorForRarity();

        // For now, all mints are Common rarity
        // Later this will be determined by oracle
        attributes[tokenId] = TotemAttributes({
            species: species,
            color: color,
            rarity: rarity,
            happiness: 100,
            experience: 0,
            stage: 0,
            isStaked: false,
            displayName: ""
        });

        _safeMint(to, tokenId);
        return tokenId;
    }

    // Helper function to get a valid color for a rarity
    function getValidColorForRarity(Rarity rarity) internal view returns (Color) {
        Color[] memory possibleColors = new Color[](5);
        uint256 count = 0;
        
        for(uint i = 0; i < 5; i++) {
            Color color = Color(i);
            if(validColorForRarity[rarity][color]) {
                possibleColors[count] = color;
                count++;
            }
        }
        
        if(count == 0) return Color.None;
        
        // For now, return the first valid color
        // Later this could be randomized with VRF
        //return possibleColors[0];
        return Color.Gray;
    }

    function evolve(uint256 tokenId) external {
         if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
         if (_ownerOf(tokenId) != msg.sender && 
            !isApprovedForAll(_ownerOf(tokenId), msg.sender) && 
            getApproved(tokenId) != msg.sender) revert NotAuthorizedForToken();

        TotemAttributes storage totem = attributes[tokenId];
        if (totem.stage >= 4) revert MaxStageReached();
        
        uint256 requiredExp = stageThresholds[totem.stage];
        if (totem.experience < requiredExp) revert InsufficientExperience();
        
        totem.stage += 1;
        
        // Verify the metadata URI exists for the new stage
        if (bytes(_metadataURIs[totem.species][totem.color][totem.stage]).length == 0) {
           revert EvolutionMetadataNotSet();
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
            attributes[tokenId].happiness = min(attributes[tokenId].happiness + happinessChange, 100);
        } else {
            attributes[tokenId].happiness = max(attributes[tokenId].happiness - happinessChange, 0);
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
        
        for(uint i = 0; i < species.length; i++) {
            if (stages[i] > 4) revert InvalidStage();
            if (colors[i] == Color.None) revert InvalidColor();
            _metadataURIs[species[i]][colors[i]][stages[i]] = ipfsHashes[i];
            emit MetadataURISet(species[i], colors[i], stages[i], ipfsHashes[i]);
        }
    }

    function setDisplayName(uint256 tokenId, string memory newName) external {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (_ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!validateDisplayName(newName)) revert InvalidNameFormat();
        
        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function forceUpdateDisplayName(uint256 tokenId, string memory newName) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (!validateDisplayName(newName)) revert InvalidNameFormat();

        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function validateDisplayName(string memory str) internal pure returns (bool) {
        bytes memory b = bytes(str);
        if (b.length < 1 || b.length > 32) return false;
        // Basic emoji range + alphanumeric + basic punctuation
        for(uint i; i<b.length; i++){
            bytes1 char = b[i];
            if(uint8(char) >= 0xF0) return false; // Block 4-byte UTF8
        }
        return true;
    }

    // Get the complete URI for a token
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        TotemAttributes memory totem = attributes[tokenId];
        
        string memory hash = _metadataURIs[totem.species][totem.color][totem.stage];
        if (bytes(hash).length == 0) revert URINotSet();
        
        return string(abi.encodePacked("ipfs://", hash));
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
    
    // Helper functions
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}