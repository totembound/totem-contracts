// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TotemTrustedForwarder is Ownable {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;
        address to; // Specific contract to call
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 public constant DOMAIN_TYPE_HASH = 
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant REQUEST_TYPE_HASH = 
        keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)");

    
    mapping(address => uint256) private _nonces;
    uint256 public maxGasPrice;
    mapping(address => bool) public allowedContracts; // The allowed target contracts

    event MetaTransactionExecuted(
        address indexed from, 
        address indexed to, 
        bytes data, 
        uint256 gasUsed,
        uint256 gasPrice,
        uint256 polSpent
    );
    event ContractWhitelisted(address indexed contractAddress, bool status);
    event GasFundingFailed(address indexed from, address indexed to, uint256 gasCost);
    event RelayExecutionFailed(
        address indexed from, 
        address indexed to, 
        string reason
    );

    // Custom errors
    error UnauthorizedContract();
    error InvalidSignature();
    error InvalidContractAddress();
    error MismatchedArrayLengths();
    error InvalidFromAddress();
    error InvalidToAddress();
    error ContractNotWhitelisted();
    error InvalidNonce();
    error TransactionFailed(string reason);

    constructor(uint256 _maxGasPrice) Ownable(msg.sender) {
        maxGasPrice = _maxGasPrice;
        _DOMAIN_SEPARATOR = _buildDomainSeparator();
    }
    
    receive() external payable {}

    function relay(ForwardRequest calldata req, bytes calldata signature) 
        external 
        returns (bool, bytes memory) 
    {
        if (!allowedContracts[req.to]) revert UnauthorizedContract();
        if (!verify(req, signature)) revert InvalidSignature();

        uint256 startGas = gasleft();
        _nonces[req.from] = req.nonce + 1;

        // Execute the transaction from the forwarder contract itself
        (bool success, bytes memory returndata) = req.to.call{gas: req.gas, value: 0}(
            abi.encodePacked(req.data, req.from)
        );

        // Handle return data and potential revert reasons
        if (!success) {
            // If the call failed, revert with the original error message
            string memory revertReason = _getRevertMsg(returndata);
            emit RelayExecutionFailed(req.from, req.to, revertReason);
            // Re-throw with the actual error
            revert TransactionFailed(revertReason);
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

    // Update to whitelist/delist contracts
    function setContractStatus(address _contract, bool _status) external onlyOwner {
        if (_contract == address(0)) revert InvalidContractAddress();

        allowedContracts[_contract] = _status;
        emit ContractWhitelisted(_contract, _status);
    }

    // Batch whitelist contracts
    function batchSetContractStatus(address[] calldata _contracts, bool[] calldata _statuses) external onlyOwner {
        if (_contracts.length != _statuses.length) revert MismatchedArrayLengths();
        
        for (uint256 i = 0; i < _contracts.length; i++) {
            if (_contracts[i] == address(0)) revert InvalidContractAddress();

            allowedContracts[_contracts[i]] = _statuses[i];
            emit ContractWhitelisted(_contracts[i], _statuses[i]);
        }
    }

    function setMaxGasPrice(uint256 _maxGasPrice) external onlyOwner {
        maxGasPrice = _maxGasPrice;
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        // Validate request parameters
        if (req.from == address(0)) revert InvalidFromAddress();
        if (req.to == address(0)) revert InvalidToAddress();
        if (!allowedContracts[req.to]) revert ContractNotWhitelisted();

        // Normalize addresses for comparison
        address normalizedFrom = address(uint160(uint256(uint160(req.from))));
        address normalizedRecovered = address(uint160(uint256(uint160(_recoverSigner(req, signature)))));
        
        // Verify signature with normalized addresses
        bool isValidSigner = normalizedRecovered == normalizedFrom;
        bool isNonZeroSigner = normalizedRecovered != address(0);

        if (_nonces[normalizedFrom] != req.nonce) revert InvalidNonce();

        return isValidSigner && isNonZeroSigner;
    }

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function domainSeparator() public view returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    function _recoverSigner(
        ForwardRequest calldata req, 
        bytes calldata signature
    ) internal view returns (address) {
        // Construct the digest using EIP-712 typed data hashing
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
            req.from,
            req.to,
            req.value,
            req.gas,
            req.nonce,
            keccak256(req.data)
        )));

        // Recover the signer
        return ECDSA.recover(digest, signature);
    }

    function _getRevertMsg(bytes memory returnData) internal pure returns (string memory) {
        // If the returnData length is less than 68, then the transaction reverted silently (without a reason string)
        if (returnData.length < 68) return "Transaction reverted silently";
        // solhint-disable-next-line
        assembly {
            // Slice the sighash.
            returnData := add(returnData, 0x04)
        }
        
        return abi.decode(returnData, (string));
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

    function _hashTypedDataV4(bytes32 structHash) private view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(_DOMAIN_SEPARATOR, structHash);
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

}