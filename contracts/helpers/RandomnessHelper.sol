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
            return uint8(17 + rand);  // RadiantGold or EtherealSilver
        }
        
        if (rarity == 3) {           // Epic: 3 colors
            rand = randomWord % 3;
            return uint8(14 + rand);  // EmeraldGreen, CrimsonRed, or DeepSapphire
        }
        
        if (rarity == 2) {           // Rare: 4 colors
            rand = randomWord % 4;
            return uint8(10 + rand);  // Golden, DarkPurple, LightBlue, or Charcoal
        }
        
        if (rarity == 1) {           // Uncommon: 5 colors
            rand = randomWord % 5;
            return uint8(5 + rand);   // Russet, Slate, Copper, Cream, or Dappled
        }
        
        // Common: 5 colors
        rand = randomWord % 5;
        return uint8(rand);           // Brown, Gray, White, Tawny, or Speckled
    }
}
