// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { TotemNFT } from "../TotemNFT.sol";

library TotemHelpers {
    function calculateSellPrice(uint256 stage, TotemNFT.Rarity rarity) internal pure returns (uint256) {
        uint256 baseValue = 200 * 10**18;
        uint256 maxBonus = 200 * 10**18;
        uint256 stageBonus = (stage * maxBonus * 60) / (4 * 100);
        uint256 rarityBonus = (uint256(rarity) * maxBonus * 40) / (4 * 100);
        return baseValue + stageBonus + rarityBonus;
    }
    
    function calculatePrestigeBonus(uint256 prestigeLevel, uint256 baseReward) internal pure returns (uint256) {
        uint256 bonusPercentage = prestigeLevel * 5 > 100 ? 100 : prestigeLevel * 5;
        return baseReward + (baseReward * bonusPercentage / 100);
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }
}