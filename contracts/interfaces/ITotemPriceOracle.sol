// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITotemPriceOracle {
    event PriceUpdated(uint256 price, uint256 timestamp);

    function getPrice() external view returns (uint256);
    function getLastUpdate() external view returns (uint256);
}