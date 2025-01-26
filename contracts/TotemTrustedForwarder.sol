// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TotemTrustedForwarder is Ownable {
    using ECDSA for bytes32;

    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 public constant DOMAIN_TYPE_HASH = 
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant REQUEST_TYPE_HASH = 
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }
    
    mapping(address => uint256) private _nonces;
    uint256 public maxGasPrice;
    uint256 public minPOLBalance;  // Minimum POL balance to maintain
    address public targetContract; // The address of the target contract

    event MetaTransactionExecuted(
        address indexed from, 
        address indexed to, 
        bytes data, 
        uint256 gasUsed,
        uint256 gasPrice,
        uint256 polSpent
    );

    constructor(uint256 _maxGasPrice) Ownable(msg.sender) {
        maxGasPrice = _maxGasPrice;
        minPOLBalance = 0.1 ether;  // 0.1 POL minimum balance
        _DOMAIN_SEPARATOR = _buildDomainSeparator();
    }
    
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        // Validate request parameters
        require(req.from != address(0), "Invalid from address");
        require(req.to != address(0), "Invalid to address");
        require(req.to == targetContract, "Invalid target contract");

        // Normalize addresses for comparison
        address normalizedFrom = address(uint160(uint256(uint160(req.from))));
        address normalizedRecovered = address(uint160(uint256(uint160(_recoverSigner(req, signature)))));
        
        // Verify signature with normalized addresses
        bool isValidSigner = normalizedRecovered == normalizedFrom;
        bool isNonZeroSigner = normalizedRecovered != address(0);

        require(_nonces[normalizedFrom] == req.nonce, "Invalid nonce");
        return isValidSigner && isNonZeroSigner;
    }

    function _recoverSigner(
        ForwardRequest calldata req, 
        bytes calldata signature
    ) internal view returns (address) {
        // Construct the digest using EIP-712 typed data hashing
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        );

        // Recover the signer
        return ECDSA.recover(digest, signature);
    }

    function relay(ForwardRequest calldata req, bytes calldata signature) 
        external 
        returns (bool, bytes memory) 
    {
        require(address(this).balance >= minPOLBalance, "Insufficient POL balance");
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        require(verify(req, signature), "Invalid signature");
        
        uint256 startGas = gasleft();
        _nonces[req.from] = req.nonce + 1;

        // Calculate estimated gas cost
        uint256 estimatedGasCost = req.gas * tx.gasprice;
        require(address(this).balance >= estimatedGasCost, "Insufficient POL for gas");

        // Execute the transaction from the forwarder contract itself
        (bool success, bytes memory returndata) = targetContract.call{gas: req.gas, value: 0}(
            abi.encodePacked(req.data, req.from)
        );

        // Handle return data and potential revert reasons
        if (!success) {
            // If the call failed, revert with the original error message
            if (returndata.length > 0) {
                // Bubble up the original revert reason
                assembly {
                    revert(add(32, returndata), mload(returndata))
                }
            } else {
                revert("Transaction failed without a reason");
            }
        }

        // Calculate actual gas used
        uint256 gasUsed = startGas - gasleft() + 21000;
        uint256 actualCost = gasUsed * tx.gasprice;

        emit MetaTransactionExecuted(
            req.from,
            req.to,
            req.data,
            gasUsed,
            tx.gasprice,
            actualCost
        );

        return (success, returndata);
    }

    function setMaxGasPrice(uint256 _maxGasPrice) external onlyOwner {
        maxGasPrice = _maxGasPrice;
    }

    function setMinPOLBalance(uint256 _minPOLBalance) external onlyOwner {
        minPOLBalance = _minPOLBalance;
    }

    function setTargetContract(address _targetContract) external {
        require(_targetContract != address(0), "Invalid target contract address");
        targetContract = _targetContract;
    }

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function withdrawPOL() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No POL to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "POL transfer failed");
    }

    function domainSeparator() public view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(
            DOMAIN_TYPE_HASH,
            keccak256(bytes("TotemTrustedForwarder")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    function _hashForwardRequest(ForwardRequest calldata req) private pure returns (bytes32) {
        return keccak256(abi.encode(
            REQUEST_TYPE_HASH,
            req.from,
            req.to,
            req.value,
            req.gas,
            req.nonce,
            keccak256(req.data)
        ));
    }

    function _hashTypedDataV4(bytes32 structHash) private view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(_DOMAIN_SEPARATOR, structHash);
    }

    receive() external payable {}
}