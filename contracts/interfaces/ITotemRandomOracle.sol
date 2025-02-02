// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITotemRandomOracle {
    struct RequestStatus {
        bool fulfilled;
        bool exists;
        uint256[] randomWords;
    }

    event RandomnessRequested(uint256 indexed requestId, address requester);
    event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords);
    
    function requestRandomness(uint32 numWords) external returns (uint256 requestId);
    function getRequestStatus(uint256 _requestId) external view returns (bool fulfilled, uint256[] memory randomWords);
}
