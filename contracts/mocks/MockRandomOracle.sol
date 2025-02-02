// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/ITotemRandomOracle.sol";

contract MockRandomOracle is ITotemRandomOracle {
    uint256 private nonce = 0;
    mapping(uint256 => RequestStatus) private requests;
    
    function requestRandomness(uint32 numWords) external returns (uint256) {
        uint256 requestId = ++nonce;
        
        uint256[] memory randomWords = new uint256[](numWords);
        for(uint i = 0; i < numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, nonce, i)));
        }
        
        requests[requestId] = RequestStatus({
            fulfilled: true,
            exists: true,
            randomWords: randomWords
        });
        
        emit RandomnessRequested(requestId, msg.sender);
        emit RandomnessFulfilled(requestId, randomWords);
        
        return requestId;
    }
    
    function getRequestStatus(uint256 _requestId) 
        external 
        view 
        returns (bool fulfilled, uint256[] memory randomWords) 
    {
        require(requests[_requestId].exists, "Request not found");
        RequestStatus memory request = requests[_requestId];
        return (request.fulfilled, request.randomWords);
    }
}