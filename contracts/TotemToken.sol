// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ITotemToken.sol";
import "./interfaces/ITotemPriceOracle.sol";

contract TotemToken is 
    ERC20Upgradeable, 
    PausableUpgradeable, 
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ITotemToken 
{
    // Notes:
    // - Upgradeable proxy pattern enables future improvements
    // - Gasless transactions via forwarder support freemium model
    // - Community-driven governance influences token utility
    // - All allocations support sustainable Web3 gaming ecosystem

    // Total Supply: 1,000,000,000 (1B) TOTEM
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    // State variables
    mapping(AllocationCategory => uint256) private _allocations;
    ITotemPriceOracle public _priceOracle;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOracle) public initializer {
        __ERC20_init("TotemToken", "TOTEM");
        __Pausable_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        if (initialOracle == address(0)) revert InvalidAddress();

        if (ITotemPriceOracle(initialOracle).getPrice() <= 0) 
            revert InvalidOracleImplementation();

        _priceOracle = ITotemPriceOracle(initialOracle);

        // Initialize allocations
        _allocations[AllocationCategory.Game] = 250_000_000 * 10**18;      // 250M 25%
        _allocations[AllocationCategory.Rewards] = 150_000_000 * 10**18;   // 150M 15%
        _allocations[AllocationCategory.Ecosystem] = 100_000_000 * 10**18; // 100M 10%
        _allocations[AllocationCategory.Liquidity] = 100_000_000 * 10**18; // 100M 10%
        _allocations[AllocationCategory.Marketing] = 150_000_000 * 10**18; // 150M 15%
        _allocations[AllocationCategory.Team] = 200_000_000 * 10**18;      // 200M 20%
        _allocations[AllocationCategory.Reserved] = 50_000_000 * 10**18;   //  50M  5%

        // Mint total supply to contract
        _mint(address(this), TOTAL_SUPPLY);

        emit TokenCreated(msg.sender, TOTAL_SUPPLY, block.timestamp);
        emit TokenAllocationsInitialized();
    }

    function transferAllocation(
        AllocationCategory fromCategory,
        address recipient,
        uint256 amount
    ) external onlyOwner whenNotPaused returns (uint256 remainingAllocation) {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount <= 0) revert InvalidAmount();
        if (amount > _allocations[fromCategory]) revert InsufficientAllocation();

        // Subtract from the specific category allocation
        _allocations[fromCategory] -= amount;

        // Transfer tokens
        _transfer(address(this), recipient, amount);

        // Emit event
        emit AllocationTransferred(fromCategory, recipient, amount);

        // Return remaining allocation
        return _allocations[fromCategory];
    }

    function transferBetweenCategories(
        AllocationCategory fromCategory,
        AllocationCategory toCategory,
        uint256 amount
    ) external onlyOwner whenNotPaused returns (uint256 remainingFromAllocation) {
        if (amount <= 0) revert InvalidAmount();
        if (amount > _allocations[fromCategory]) revert InsufficientAllocation();

        // Subtract from the source category
        _allocations[fromCategory] -= amount;
        
        // Add to the destination category
        _allocations[toCategory] += amount;

        // Emit event
        emit CrossCategoryTransfer(fromCategory, toCategory, amount);

        // Return remaining allocation of the source category
        return _allocations[fromCategory];
    }

    function getTokenPrice() external view returns (uint256) {
        return _priceOracle.getPrice();
    }

    function getLastPriceUpdate() external view returns (uint256) {
        return _priceOracle.getLastUpdate();
    }

    function getRemainingAllocation(AllocationCategory category) external view returns (uint256) {
        return _allocations[category];
    }

    function getAllRemainingAllocations() external view returns (uint256[] memory) {
        uint256[] memory remainingAllocations = new uint256[](7);
    
        remainingAllocations[0] = _allocations[AllocationCategory.Game];
        remainingAllocations[1] = _allocations[AllocationCategory.Rewards];
        remainingAllocations[2] = _allocations[AllocationCategory.Ecosystem];
        remainingAllocations[3] = _allocations[AllocationCategory.Marketing];
        remainingAllocations[4] = _allocations[AllocationCategory.Liquidity];
        remainingAllocations[5] = _allocations[AllocationCategory.Team];
        remainingAllocations[6] = _allocations[AllocationCategory.Reserved];
        
        return remainingAllocations;
    }

    function priceOracle() external view returns (address) {
        return address(_priceOracle);
    }

    // Admin functions
    function updateOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        if (ITotemPriceOracle(newOracle).getPrice() <= 0)
            revert InvalidOracleImplementation();
        
        _priceOracle = ITotemPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    // Override transfer functions to enforce pause
    function transfer(address to, uint256 amount) 
        public 
        virtual 
        override(ERC20Upgradeable, ITotemToken) 
        whenNotPaused 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        virtual
        override(ERC20Upgradeable, ITotemToken)
        whenNotPaused
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }
    
    function approve(address spender, uint256 amount)
        public
        virtual
        override(ERC20Upgradeable, ITotemToken)
        whenNotPaused
        returns (bool)
    {
        return super.approve(spender, amount);
    }

    // Pause functionality
    function pause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    // Emergency functions
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        if (tokenAddress == address(0)) revert InvalidAddress();
        if (tokenAddress == address(this)) revert CannotRecoverToken();
        IERC20(tokenAddress).transfer(owner(), tokenAmount);
    }

    // Internal functions
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}