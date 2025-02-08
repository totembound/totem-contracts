// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library RandomnessHelper {
    function getRandomNumber(uint256 randomWord, uint256 min, uint256 max) internal pure returns (uint256) {
        require(max > min, "Invalid range");
        return (randomWord % (max - min + 1)) + min;
    }
    
    function getRarity(uint256 randomWord) internal pure returns (uint8) {
        uint256 rand = randomWord % 1000; // 0-999
        
        if (rand < 5) return 4;       // Legendary: 0.5%
        if (rand < 30) return 3;      // Epic: 2.5%
        if (rand < 100) return 2;     // Rare: 7%
        if (rand < 250) return 1;     // Uncommon: 15%
        return 0;                     // Common: 75%
    }
    
    function getColorForRarity(uint256 randomWord, uint8 rarity) internal pure returns (uint8) {
        uint256 rand;
        
        if (rarity == 4) {           // Legendary: 2 colors
            rand = randomWord % 2;
            return uint8(14 + rand);  // RadiantGold (14), EtherealSilver (15)
        }
        
        if (rarity == 3) {           // Epic: 3 colors
            rand = randomWord % 3;
            return uint8(11 + rand);  // EmeraldGreen (11), CrimsonRed (12), DeepSapphire (13)
        }
        
        if (rarity == 2) {           // Rare: 3 colors
            rand = randomWord % 3;
            return uint8(8 + rand);   // Golden (8), DarkPurple (9), Charcoal (10)
        }
        
        if (rarity == 1) {           // Uncommon: 4 colors
            rand = randomWord % 4;
            return uint8(4 + rand);   // Slate (4), Copper (5), Cream (6), Dappled (7)
        }
        
                                      // Common: 4 colors
        rand = randomWord % 4;
        return uint8(rand);           // Brown (0), Gray (1), White (2), Tawny (3)
    }
}
