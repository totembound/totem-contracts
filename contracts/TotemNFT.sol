// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
        Brown,
        Gray,
        White,
        Tawny,
        Speckled,
        
        // Uncommon Colors
        Russet,
        Slate,
        Copper,
        Cream,
        Dappled,
        
        // Rare Colors
        Golden,
        DarkPurple,
        LightBlue,
        Charcoal,
        
        // Epic Colors
        EmeraldGreen,
        CrimsonRed,
        DeepSapphire,
        
        // Legendary Colors
        RadiantGold,
        EtherealSilver,
        
        None
    }

    struct TotemAttributes {
        Species species;
        Color color;
        Rarity rarity;
        uint256 happiness;
        uint256 experience;
        uint256 stage;      // 0 (Egg/Pup) to 4 (Elder)
        uint256 lastFed;
        bool isStaked;      // For stage 4 staking
        string displayName;
    }

    uint256 public constant MINT_PRICE = 500 * 10**18; // 500 TOTEM

    // Mapping from token ID to attributes
    mapping(uint256 => TotemAttributes) public attributes;
    
    // Mapping for complete IPFS hashes: species => color => stage => hash
    mapping(Species => mapping(Color => mapping(uint256 => string))) private _metadataURIs;

    // Mapping to control which colors are valid for each rarity
    mapping(Rarity => mapping(Color => bool)) public validColorForRarity;

    // Experience thresholds for each stage
    uint256[4] public stageThresholds = [500, 1500, 3500, 7500];
    
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
        require(species != Species.None, "Invalid species");
        uint256 tokenId = totalSupply() + 1;
        
        // For now, all mints are Common rarity
        rarity = Rarity.Common;

        // Assign a valid color for this rarity
        Color color = getValidColorForRarity(rarity);
        require(color != Color.None, "No valid color for rarity");

        // For now, all mints are Common rarity
        // Later this will be determined by oracle
        attributes[tokenId] = TotemAttributes({
            species: species,
            color: color,
            rarity: rarity,
            happiness: 100,
            experience: 0,
            stage: 0,
            lastFed: block.timestamp - 86400,
            isStaked: false,
            displayName: ''
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
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(_ownerOf(tokenId) == msg.sender || 
                isApprovedForAll(_ownerOf(tokenId), msg.sender) || 
                getApproved(tokenId) == msg.sender, 
                "Not authorized");

        TotemAttributes storage totem = attributes[tokenId];
        require(totem.stage < 4, "Max stage reached");
        
        uint256 requiredExp = stageThresholds[totem.stage];
        require(totem.experience >= requiredExp, "Insufficient experience");
        
        totem.stage += 1;
        
        // Verify the metadata URI exists for the new stage
        require(
            bytes(_metadataURIs[totem.species][totem.color][totem.stage]).length > 0,
            "Evolution metadata not set"
        );
        
        emit TotemEvolved(
            tokenId, 
            totem.stage, 
            totem.species, 
            totem.rarity
        );
    }

    function updateHappiness(uint256 tokenId, uint256 amount, bool increase) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        if (increase) {
            attributes[tokenId].happiness = min(attributes[tokenId].happiness + amount, 100);
        } else {
            attributes[tokenId].happiness = max(attributes[tokenId].happiness - amount, 0);
        }
    }

    function addExperience(uint256 tokenId, uint256 amount) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        attributes[tokenId].experience += amount;
    }

    function updateLastFed(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        attributes[tokenId].lastFed = block.timestamp;
    }

    // Set the IPFS hash for a specific species-color-stage combination
    function setMetadataURI(
        Species species,
        Color color,
        uint256 stage,
        string memory ipfsHash
    ) external onlyOwner {
        require(stage <= 4, "Invalid stage");
        require(color != Color.None, "Invalid color");
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
        require(
            species.length == colors.length &&
            colors.length == stages.length &&
            stages.length == ipfsHashes.length,
            "Array lengths must match"
        );

        for(uint i = 0; i < species.length; i++) {
            require(stages[i] <= 4, "Invalid stage");
            require(colors[i] != Color.None, "Invalid color");
            _metadataURIs[species[i]][colors[i]][stages[i]] = ipfsHashes[i];
            emit MetadataURISet(species[i], colors[i], stages[i], ipfsHashes[i]);
        }
    }

    function setDisplayName(uint256 tokenId, string memory newName) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(_ownerOf(tokenId) == msg.sender, "Not owner");
        require(validateDisplayName(newName), "Invalid name format");
        
        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function forceUpdateDisplayName(uint256 tokenId, string memory newName) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        require(validateDisplayName(newName), "Invalid name format");

        attributes[tokenId].displayName = newName;
        emit DisplayNameSet(tokenId, newName);
    }

    function validateDisplayName(string memory str) internal pure returns (bool) {
        bytes memory b = bytes(str);
        require(b.length >= 1 && b.length <= 32, "Invalid length");
        // Basic emoji range + alphanumeric + basic punctuation
        for(uint i; i<b.length; i++){
            bytes1 char = b[i];
            if(uint8(char) >= 0xF0) return false; // Block 4-byte UTF8
        }
        return true;
    }

    // Get the complete URI for a token
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        TotemAttributes memory totem = attributes[tokenId];
        
        string memory hash = _metadataURIs[totem.species][totem.color][totem.stage];
        require(bytes(hash).length > 0, "URI not set for this combination");
        
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
        require(uint8(species) < uint8(Species.None), "Invalid species");
        require(uint8(color) < uint8(Color.None), "Invalid color");
        require(stage <= 4, "Invalid stage");
    

        string memory hash = _metadataURIs[species][color][stage];
        require(bytes(hash).length > 0, "URI not set for this combination");
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