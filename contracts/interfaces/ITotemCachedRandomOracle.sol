// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ITotemRandomOracle } from "./ITotemRandomOracle.sol";

interface ITotemCachedRandomOracle is ITotemRandomOracle {
    function refillCache() external;
    function updateBatchSize(uint32 newBatchSize) external;
    function updateLowThreshold(uint256 newThreshold) external;

    function getCacheStatus() external view returns (
        uint256 available, 
        uint256 total, 
        bool pendingRefill,
        uint256 lowThreshold
    );
}