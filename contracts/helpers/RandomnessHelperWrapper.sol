// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { RandomnessHelper } from "./RandomnessHelper.sol";

/**
 * @title RandomnessHelperWrapper
 * @dev A wrapper contract to expose RandomnessHelper library functions for testing
 */
contract RandomnessHelperWrapper {
    /**
     * @dev Calls the getRandomNumber function from RandomnessHelper
     */
    function testGetRandomNumber(uint256 randomWord, uint256 min, uint256 max) external pure returns (uint256) {
        return RandomnessHelper.getRandomNumber(randomWord, min, max);
    }
    
    /**
     * @dev Calls the getRarity function from RandomnessHelper
     */
    function testGetRarity(uint256 randomWord) external pure returns (uint8) {
        return RandomnessHelper.getRarity(randomWord);
    }
    
    /**
     * @dev Calls the getColorForRarity function from RandomnessHelper
     */
    function testGetColorForRarity(uint256 randomWord, uint8 rarity) external pure returns (uint8) {
        return RandomnessHelper.getColorForRarity(randomWord, rarity);
    }
    
    /**
     * @dev Calls the getRarityAndColor function from RandomnessHelper
     */
    function testGetRarityAndColor(uint256 randomWord) external pure returns (uint8 rarity, uint8 color) {
        return RandomnessHelper.getRarityAndColor(randomWord);
    }
}