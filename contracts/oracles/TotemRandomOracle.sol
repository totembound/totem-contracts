// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "../interfaces/ITotemRandomOracle.sol";

// Production implementation using Chainlink VRF
contract TotemRandomOracle is VRFConsumerBaseV2, ConfirmedOwner, ITotemRandomOracle {
    event RequestSent(uint256 requestId, uint32 numWords);
    
    VRFCoordinatorV2Interface COORDINATOR;
    
    // Your subscription ID
    uint64 s_subscriptionId;
    
    // The gas lane to use (varies by network)
    bytes32 keyHash;
    
    // Past requests
    mapping(uint256 => RequestStatus) public s_requests;
    
    // Maximum gas to use for the callback
    uint32 callbackGasLimit = 100000;
    
    // The default is 3, but you can set this higher
    uint16 requestConfirmations = 3;
    
    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(vrfCoordinator) ConfirmedOwner(msg.sender) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;
        keyHash = _keyHash;
    }
    
    function requestRandomness(
        uint32 numWords
    ) external override returns (uint256) {
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        
        s_requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            randomWords: new uint256[](0)
        });
        
        emit RandomnessRequested(requestId, msg.sender);
        emit RequestSent(requestId, numWords);
        
        return requestId;
    }
    
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        require(s_requests[_requestId].exists, "Request not found");
        s_requests[_requestId].fulfilled = true;
        s_requests[_requestId].randomWords = _randomWords;
        emit RandomnessFulfilled(_requestId, _randomWords);
    }
    
    function getRequestStatus(
        uint256 _requestId
    ) external view override returns (bool fulfilled, uint256[] memory randomWords) {
        require(s_requests[_requestId].exists, "Request not found");
        RequestStatus memory request = s_requests[_requestId];
        return (request.fulfilled, request.randomWords);
    }
}
