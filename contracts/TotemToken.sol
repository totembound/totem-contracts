// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITotemPriceOracle.sol";

contract TotemToken is ERC20, Pausable, Ownable {
    ITotemPriceOracle public priceOracle;
    address public gameProxy;
    bool public gameplayTokensTransferred;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens

    event OracleUpdated(address newOracle);
    event GameProxyUpdated(address newProxy);
    event GameplayTokensTransferred(address indexed proxyAddress, uint256 amount);

    constructor(address initialOracle) ERC20("TotemToken", "TOTEM") Ownable(msg.sender) {
        require(initialOracle != address(0), "Invalid oracle address");
        priceOracle = ITotemPriceOracle(initialOracle);

        uint256 initialGameplayTokens = (TOTAL_SUPPLY * 25) / 100;  // 25%
        uint256 reservedGameplayTokens = (TOTAL_SUPPLY * 25) / 100; // 25%
        uint256 teamAllocation = (TOTAL_SUPPLY * 20) / 100;         // 20%
        uint256 marketingAllocation = (TOTAL_SUPPLY * 15) / 100;    // 15%
        uint256 liquidityAllocation = (TOTAL_SUPPLY * 10) / 100;    // 10%
        uint256 reserveAllocation = (TOTAL_SUPPLY * 5) / 100;       // 5%

        _mint(address(this), initialGameplayTokens);
        _mint(msg.sender, reservedGameplayTokens);
        _mint(msg.sender, teamAllocation);
        _mint(msg.sender, marketingAllocation);
        _mint(msg.sender, liquidityAllocation);
        _mint(msg.sender, reserveAllocation);
    }

    function getTokenPrice() external view returns (uint256) {
        return priceOracle.getPrice();
    }

    function getLastPriceUpdate() external view returns (uint256) {
        return priceOracle.getLastUpdate();
    }

    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        // Optional: Add additional validation for the new oracle
        require(ITotemPriceOracle(newOracle).getPrice() > 0, "Invalid oracle implementation");
        
        priceOracle = ITotemPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    function updateGameProxy(address newProxy) external onlyOwner {
        require(newProxy != address(0), "Invalid proxy");
        require(!gameplayTokensTransferred, "Tokens already transferred");
        gameProxy = newProxy;
        emit GameProxyUpdated(newProxy);
    }

    function transferGameplayAllocation() external onlyOwner whenNotPaused {
        require(gameProxy != address(0), "Game proxy not set");
        require(!gameplayTokensTransferred, "Gameplay tokens already transferred");

        uint256 gameplayBalance = balanceOf(address(this));
        require(gameplayBalance > 0, "No gameplay tokens to transfer");

        gameplayTokensTransferred = true;
        _transfer(address(this), gameProxy, gameplayBalance);
        
        emit GameplayTokensTransferred(gameProxy, gameplayBalance);
    }

    // Override transfer functions to enforce pause
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
    
    function approve(address spender, uint256 amount) public override whenNotPaused returns (bool) {
        return super.approve(spender, amount);
    }

    // Pause functionality
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency functions
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot recover TOTEM");
        IERC20(tokenAddress).transfer(owner(), tokenAmount);
    }
}