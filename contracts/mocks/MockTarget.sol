// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MockTarget
 * @dev A mock contract for testing the TotemTrustedForwarder.
 * This contract implements ERC-2771 style trusted forwarder functionality
 * to extract the original sender from the calldata appended by the forwarder.
 */
contract MockTarget {
    address public lastCaller;
    string public lastMessage;
    
    event FunctionExecuted(address caller, string message);
    
    /**
     * @dev Extracts the original sender from the calldata if it exists.
     * This implements ERC-2771 style message handling.
     * @return sender The original sender of the transaction
     */
    function _msgSender() internal view returns (address sender) {
        // Check if calldata is long enough to contain an address at the end
        if (msg.data.length >= 20) {
            // Extract the original sender address from the end of the calldata
            assembly {
                // Find the appended address (last 20 bytes)
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
            
            // Ensure sender is not zero address as an additional safety check
            if (sender == address(0)) {
                return msg.sender;
            }
        } else {
            return msg.sender;
        }
    }
    
    /**
     * @dev A test function that records who called it and a message.
     * @param message A test message to record
     */
    function executeFunction(string memory message) external {
        // Use _msgSender() to get the original sender
        address originalSender = _msgSender();
        lastCaller = originalSender;
        lastMessage = message;
        
        emit FunctionExecuted(originalSender, message);
    }
    
    /**
     * @dev A test function that always reverts, used for testing error handling.
     */
    function revertingFunction() external pure {
        revert("This function always reverts");
    }
}