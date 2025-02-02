// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ITotemPriceOracle.sol";

contract MockPriceOracle is ITotemPriceOracle {
    uint256 private price = 100;
    uint256 private lastUpdate;

    constructor() {
        lastUpdate = block.timestamp;
    }

    function getPrice() external view returns (uint256) {
        return price;
    }

    function getLastUpdate() external view returns (uint256) {
        return lastUpdate;
    }

    // Additional functions for testing
    function setPrice(uint256 _price) external {
        price = _price;
        lastUpdate = block.timestamp;
    }
}