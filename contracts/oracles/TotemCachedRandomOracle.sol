// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VRFConsumerBaseV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import { ConfirmedOwner } from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import { ITotemCachedRandomOracle } from "../interfaces/ITotemCachedRandomOracle.sol";

// Production implementation using Chainlink VRF with caching
contract TotemCachedRandomOracle is ITotemCachedRandomOracle, ConfirmedOwner, VRFConsumerBaseV2Plus {
    // Chainlink VRF Configuration
    address private _vrfCoordinator;
    bytes32 private _keyHash;
    uint256 private _subscriptionId;
    uint32 private _callbackGasLimit = 3000000;

    // Random number cache
    uint256[] private _randomnessCache;
    uint256 private _currentIndex;
    
    // Cache configuration
    uint32 private _batchSize = 50;      // Request 50 random numbers at a time
    uint256 private _lowThreshold = 10;  // Request more when 10 or fewer left
    bool private _requestPending;        // Track if we have a pending request
   
    mapping(address => bool) public authorizedConsumers;
    // Track individual consumer requests
    mapping(uint256 => RequestStatus) public requests;
    uint256 private _nextRequestId = 1;

    // Track VRF request IDs to internal mapping
    mapping(uint256 => bool) private _vrfRequests;
    
    // Events
    event CacheRefilled(uint256 vrfRequestId, uint256 count);
    event CacheRefillRequested(uint256 vrfRequestId, uint32 amount);
    event CacheLow(uint256 currentCount, uint256 threshold);
    
    modifier onlyAuthorized() {
        require(authorizedConsumers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        _vrfCoordinator = vrfCoordinator;
        _subscriptionId = subscriptionId;
        _keyHash = keyHash;
    }
    
    // Request randomness from the cache
    function requestRandomness(
        uint32 numWords
    ) external override onlyAuthorized returns (uint256) {
        // Ensure we have enough randomness available
        require(_randomnessCache.length - _currentIndex >= numWords, "Insufficient randomness in cache");
        
        // Generate a unique request ID
        uint256 requestId = _nextRequestId++;
        
        // Create array for the random words
        uint256[] memory randomWords = new uint256[](numWords);
        
        // Fill from cache
        for (uint32 i = 0; i < numWords; i++) {
            randomWords[i] = _randomnessCache[_currentIndex];
            _currentIndex++;
        }
        
        // Store the request as already fulfilled
        requests[requestId] = RequestStatus({
            fulfilled: true,  // Immediately fulfilled
            exists: true,
            randomWords: randomWords
        });
        
        // Emit events
        emit RandomnessRequested(requestId, msg.sender);
        emit RandomnessFulfilled(requestId, randomWords);
        
        // Check if we need to refill after consuming
        if (_randomnessCache.length - _currentIndex <= _lowThreshold && !_requestPending) {
            _requestMoreRandomness();
            emit CacheLow(_randomnessCache.length - _currentIndex, _lowThreshold);
        }
        
        return requestId;
    }
    
    // Manually trigger a cache refill
    function refillCache() external onlyOwner {
        require(!_requestPending, "Refill already pending");
        _requestMoreRandomness();
    }
    
    function resetPendingRefillFlag() external onlyOwner {
       _requestPending = false;
    }

    // Update batch size - how many randoms to request at once
    function updateBatchSize(uint32 newBatchSize) external onlyOwner {
        require(newBatchSize > 0 && newBatchSize <= 500, "Batch size must be between 1 and 500");
        _batchSize = newBatchSize;
    }
    
    // Update low threshold - when to trigger a refill
    function updateLowThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold < _batchSize, "Threshold must be less than batch size");
        _lowThreshold = newThreshold;
    }
    
    // Update callback gas limit
    function updateCallbackGasLimit(uint32 newLimit) external onlyOwner {
        _callbackGasLimit = newLimit;
    }
    
    function setAuthorizedConsumer(address consumer, bool authorized) external onlyOwner {
        authorizedConsumers[consumer] = authorized;
    }

    // Check the status of a specific request
    function getRequestStatus(
        uint256 requestId
    ) external view override returns (bool fulfilled, uint256[] memory randomWords) {
        require(requests[requestId].exists, "Request not found");
        return (requests[requestId].fulfilled, requests[requestId].randomWords);
    }
    
    // Get current cache status - useful for frontend/Lambda to check
    function getCacheStatus() external view returns (
        uint256 available, 
        uint256 total, 
        bool pendingRefill,
        uint256 lowThreshold
    ) {
        return (
            _randomnessCache.length - _currentIndex,
            _randomnessCache.length,
            _requestPending,
            _lowThreshold
        );
    }

    // VRF callback when randomness is ready
    // solhint-disable-next-line
    function fulfillRandomWords(
        uint256 requestId, 
        uint256[] calldata randomWords
    ) internal override {
        // Only process VRF requests for cache refills
        if (_vrfRequests[requestId]) {
            // Reset the cache if it's empty
            if (_currentIndex >= _randomnessCache.length) {
                _randomnessCache = randomWords;
                _currentIndex = 0;
            } else {
                // Otherwise append to existing cache
                for (uint256 i = 0; i < randomWords.length; i++) {
                    _randomnessCache.push(randomWords[i]);
                }
            }
            
            // Mark request as no longer pending
            _requestPending = false;
            delete _vrfRequests[requestId];
            
            emit CacheRefilled(requestId, randomWords.length);
        }
    }

    // Request more randomness from Chainlink VRF
    function _requestMoreRandomness() private {
        _requestPending = true;
        
        // Request the random words
        uint256 vrfRequestId = s_vrfCoordinator.requestRandomWords(
            // Build the request for VRF v2.5
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: _keyHash,
                subId: _subscriptionId,
                requestConfirmations: 3, // Default for v2.5
                callbackGasLimit: _callbackGasLimit,
                numWords: _batchSize,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({
                        nativePayment: true  // Use native payment
                    })
                )
            })
        );

        // Track this VRF request
        _vrfRequests[vrfRequestId] = true;
        
        emit CacheRefillRequested(vrfRequestId, _batchSize);
    }
}