// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { VRFConsumerBaseV2 } from "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import { VRFCoordinatorV2Interface } from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import { ConfirmedOwner } from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import { ITotemRandomOracle } from "../interfaces/ITotemRandomOracle.sol";

// Production implementation using Chainlink VRF
contract TotemRandomOracle is VRFConsumerBaseV2, ConfirmedOwner, ITotemRandomOracle {
    VRFCoordinatorV2Interface private _coordinator;
    
    // Your subscription ID
    uint64 private _subscriptionId;
    
    // The gas lane to use (varies by network)
    bytes32 private _keyHash;
    
    // Past requests
    mapping(uint256 => RequestStatus) public requests;
    
    // Maximum gas to use for the callback
    uint32 private _callbackGasLimit = 100000;
    
    // The default is 3, but you can set this higher
    uint16 private _requestConfirmations = 3;

    event RequestSent(uint256 requestId, uint32 numWords);

    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash
    ) VRFConsumerBaseV2(vrfCoordinator) ConfirmedOwner(msg.sender) {
        _coordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        _subscriptionId = subscriptionId;
        _keyHash = keyHash;
    }
    
    function requestRandomness(
        uint32 numWords
    ) external override returns (uint256) {
        uint256 requestId = _coordinator.requestRandomWords(
            _keyHash,
            _subscriptionId,
            _requestConfirmations,
            _callbackGasLimit,
            numWords
        );
        
        requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            randomWords: new uint256[](0)
        });
        
        emit RandomnessRequested(requestId, msg.sender);
        emit RequestSent(requestId, numWords);
        
        return requestId;
    }

    function getRequestStatus(
        uint256 requestId
    ) external view override returns (bool fulfilled, uint256[] memory randomWords) {
        require(requests[requestId].exists, "Request not found");
        RequestStatus memory request = requests[requestId];
        return (request.fulfilled, request.randomWords);
    }
    
    // solhint-disable-next-line
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        require(requests[requestId].exists, "Request not found");
        requests[requestId].fulfilled = true;
        requests[requestId].randomWords = randomWords;
        emit RandomnessFulfilled(requestId, randomWords);
    }
    
}
