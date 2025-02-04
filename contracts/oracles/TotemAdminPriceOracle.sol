// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ITotemPriceOracle } from "../interfaces/ITotemPriceOracle.sol";

contract TotemAdminPriceOracle is ITotemPriceOracle, Ownable {
    uint256 private _currentPrice;
    uint256 private _lastUpdate;

    constructor(uint256 initialPrice) Ownable(msg.sender) {
        _currentPrice = initialPrice;
        _lastUpdate = block.timestamp;
        emit PriceUpdated(initialPrice, block.timestamp);
    }
    
    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        _currentPrice = newPrice;
        _lastUpdate = block.timestamp;
        emit PriceUpdated(newPrice, block.timestamp);
    }
    
    function getPrice() external view override returns (uint256) {
        return _currentPrice;
    }
    
    function getLastUpdate() external view override returns (uint256) {
        return _lastUpdate;
    }
}
