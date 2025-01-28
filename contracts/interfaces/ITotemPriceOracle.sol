// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITotemPriceOracle {
    function getPrice() external view returns (uint256);
    function getLastUpdate() external view returns (uint256);
    
    // Events that implementations should emit
    event PriceUpdated(uint256 price, uint256 timestamp);
}