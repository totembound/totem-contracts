// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ITotemCachedRandomOracle.sol";

contract MockRandomOracle is ITotemCachedRandomOracle {
    uint256 private _nonce = 0;
    mapping(uint256 => RequestStatus) private _requests;
    address private _owner;

     // Mock cache values
    uint256 private _mockAvailable = 500;
    uint256 private _mockTotal = 500;
    bool private _mockPendingRefill = false;
    uint256 private _mockLowThreshold = 20;
    
    constructor() {
        _owner = msg.sender;  // Set deployer as owner
    }

    function requestRandomness(uint32 numWords) external returns (uint256) {
        uint256 requestId = ++_nonce;
        
        uint256[] memory randomWords = new uint256[](numWords);
        for(uint i = 0; i < numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, _nonce, i)));
        }
        
        _requests[requestId] = RequestStatus({
            fulfilled: true,
            exists: true,
            randomWords: randomWords
        });
        
         // Reduce mock available count
        if(_mockAvailable >= numWords) {
            _mockAvailable -= numWords;
        } else {
            _mockAvailable = 0;
        }

        emit RandomnessRequested(requestId, msg.sender);
        emit RandomnessFulfilled(requestId, randomWords);
        
        return requestId;
    }
    
    function owner() external view returns (address) {
        return _owner;
    }

    function getRequestStatus(uint256 _requestId) 
        external 
        view 
        returns (bool fulfilled, uint256[] memory randomWords) 
    {
        require(_requests[_requestId].exists, "Request not found");
        RequestStatus memory request = _requests[_requestId];
        return (request.fulfilled, request.randomWords);
    }

    // Mock implementation for testing the interface
    function getCacheStatus() external view override returns (
        uint256 available, 
        uint256 total, 
        bool pendingRefill,
        uint256 lowThreshold
    ) {
        return (_mockAvailable, _mockTotal, _mockPendingRefill, _mockLowThreshold);
    }
    
    // Mock functions that simulate cache management
    function refillCache() external override {
        _mockAvailable = _mockTotal;
        _mockPendingRefill = false;
    }
    
    function updateBatchSize(uint32 newBatchSize) external override {
        _mockTotal = newBatchSize;
        _mockAvailable = newBatchSize;
    }
    
    function updateLowThreshold(uint256 newThreshold) external override {
        _mockLowThreshold = newThreshold;
    }
    
    // Test helpers to manipulate mock state
    function setMockCacheValues(
        uint256 available, 
        uint256 total, 
        bool pendingRefill,
        uint256 lowThreshold
    ) external {
        _mockAvailable = available;
        _mockTotal = total;
        _mockPendingRefill = pendingRefill;
        _mockLowThreshold = lowThreshold;
    }
}