// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import { ITotemPriceOracle } from "../interfaces/ITotemPriceOracle.sol";

contract TotemChainlinkPriceOracle is ITotemPriceOracle, Ownable {
    AggregatorV3Interface private _polPriceAggregator;
    uint256 private _priceRatio; // Ratio of TOTEM to POL (scaled by 1e18)
    uint256 private _lastUpdate;
    
    event RatioUpdated(uint256 newRatio, uint256 timestamp);
    
    constructor(address polAggregator, uint256 initialRatio) Ownable(msg.sender) {
        _polPriceAggregator = AggregatorV3Interface(polAggregator);
        _priceRatio = initialRatio;
        _lastUpdate = block.timestamp;
        emit RatioUpdated(initialRatio, block.timestamp);
    }

    function updateRatio(uint256 newRatio) external onlyOwner {
        require(newRatio > 0, "Invalid ratio");
        _priceRatio = newRatio;
        _lastUpdate = block.timestamp;
        emit RatioUpdated(newRatio, block.timestamp);
        emit PriceUpdated(this.getPrice(), block.timestamp);
    }

    function getPrice() external view override returns (uint256) {
        (, int256 price,,,) = _polPriceAggregator.latestRoundData();
        require(price > 0, "Invalid POL price");
        
        return (uint256(price) * _priceRatio) / 1e18;
    }
    
    function getLastUpdate() external view override returns (uint256) {
        (,,,uint256 updatedAt,) = _polPriceAggregator.latestRoundData();
        return updatedAt;
    }
}