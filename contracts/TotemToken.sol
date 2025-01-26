// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol"; // EIP-2612
import "@openzeppelin/contracts/access/Ownable.sol";

contract TotemToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant TOKEN_PRICE = 0.01 ether; // Price in POL

    address public gameProxy;
    bool public gameplayTokensTransferred;

    event GameProxySet(address indexed proxyAddress);
    event GameplayTokensTransferred(address indexed proxyAddress, uint256 amount);

    constructor() ERC20("TotemToken", "TOTEM") Ownable(msg.sender) {
        uint256 gameplayAllocation = (TOTAL_SUPPLY * 50) / 100;    // 50%
        uint256 teamAllocation = (TOTAL_SUPPLY * 20) / 100;        // 20%
        uint256 marketingAllocation = (TOTAL_SUPPLY * 15) / 100;   // 15%
        uint256 liquidityAllocation = (TOTAL_SUPPLY * 10) / 100;   // 10%
        uint256 reserveAllocation = (TOTAL_SUPPLY * 5) / 100;      // 5%

        _mint(address(this), gameplayAllocation);    
        _mint(msg.sender, teamAllocation);           
        _mint(msg.sender, marketingAllocation);      
        _mint(msg.sender, liquidityAllocation);      
        _mint(msg.sender, reserveAllocation);        
    }

    function setGameProxy(address _gameProxy) external onlyOwner {
        require(_gameProxy != address(0), "Invalid proxy address");
        require(gameProxy == address(0), "Game proxy already set");
        
        gameProxy = _gameProxy;
        emit GameProxySet(_gameProxy);
    }

    function transferGameplayAllocation() external onlyOwner {
        require(gameProxy != address(0), "Game proxy not set");
        require(!gameplayTokensTransferred, "Gameplay tokens already transferred");

        uint256 gameplayBalance = balanceOf(address(this));
        require(gameplayBalance > 0, "No gameplay tokens to transfer");

        gameplayTokensTransferred = true;
        _transfer(address(this), gameProxy, gameplayBalance);
        
        emit GameplayTokensTransferred(gameProxy, gameplayBalance);
    }
}