// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITotemPriceOracle.sol";

error InvalidAddress();
error InvalidOracleImplementation();
error InvalidAmount();
error InsufficientAllocation();
error CannotRecoverToken();

contract TotemToken is ERC20, Pausable, Ownable {

    // Total Supply: 1,000,000,000 (1B) TOTEM
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    enum AllocationCategory {
        Game,        // 25% - Gaming infrastructure, player incentives, in-game economy and NFT integrations
        Rewards,     // 15% - Community staking rewards, gameplay achievements, and participation incentives
        Ecosystem,   // 10% - Community grants, developer incentives, integration partners, and dApp expansion
        Liquidity,   // 10% - Initial and ongoing DEX liquidity provision, ensuring stable token trading
        Marketing,   // 15% - Community growth, brand awareness, events, and promotional activities
        Team,        // 20% - Development, operations, and core team incentives
        Reserved     //  5% - Strategic partnerships, future opportunities, and contingency fund
    }

    // Notes:
    // - Upgradeable proxy pattern enables future improvements
    // - Gasless transactions via forwarder support freemium model
    // - Community-driven governance influences token utility
    // - All allocations support sustainable Web3 gaming ecosystem

    // State variables
    mapping(AllocationCategory => uint256) private allocations;
    ITotemPriceOracle public priceOracle;

    // Events
    event OracleUpdated(address newOracle);
    event AllocationTransferred(
        AllocationCategory category, 
        address indexed recipient, 
        uint256 amount
    );
    event CrossCategoryTransfer(
        AllocationCategory indexed fromCategory,
        AllocationCategory indexed toCategory,
        uint256 amount
    );
    event TokenCreated(
        address indexed creator, 
        uint256 totalSupply, 
        uint256 timestamp
    );
    event TokenAllocationsInitialized();

    constructor(address initialOracle) ERC20("TotemToken", "TOTEM") Ownable(msg.sender) {
        if (initialOracle == address(0)) revert InvalidAddress();
        priceOracle = ITotemPriceOracle(initialOracle);

        // Direct allocation amounts
        allocations[AllocationCategory.Game] = 250_000_000 * 10**18;      // 250M 25%
        allocations[AllocationCategory.Rewards] = 150_000_000 * 10**18;   // 150M 15%
        allocations[AllocationCategory.Ecosystem] = 100_000_000 * 10**18; // 100M 10%
        allocations[AllocationCategory.Marketing] = 150_000_000 * 10**18; // 150M 15%
        allocations[AllocationCategory.Liquidity] = 100_000_000 * 10**18; // 100M 10%
        allocations[AllocationCategory.Team] = 200_000_000 * 10**18;      // 200M 20%
        allocations[AllocationCategory.Reserved] = 50_000_000 * 10**18;   //  50M  5%

        // Mint to contract initially
        _mint(address(this), TOTAL_SUPPLY);

        emit TokenCreated(
            msg.sender, 
            TOTAL_SUPPLY, 
            block.timestamp
        );
        emit TokenAllocationsInitialized();
    }

    function getTokenPrice() external view returns (uint256) {
        return priceOracle.getPrice();
    }

    function getLastPriceUpdate() external view returns (uint256) {
        return priceOracle.getLastUpdate();
    }

    function transferAllocation(
        AllocationCategory fromCategory,
        address recipient,
        uint256 amount
    ) external onlyOwner whenNotPaused returns (uint256 remainingAllocation) {
        if (amount <= 0) revert InvalidAmount();
        if (amount > allocations[fromCategory]) revert InsufficientAllocation();

        // Subtract from the specific category allocation
        allocations[fromCategory] -= amount;

        // Transfer tokens
        _transfer(address(this), recipient, amount);

        // Emit event
        emit AllocationTransferred(fromCategory, recipient, amount);

        // Return remaining allocation
        return allocations[fromCategory];
    }

    function transferBetweenCategories(
        AllocationCategory fromCategory,
        AllocationCategory toCategory,
        uint256 amount
    ) external onlyOwner whenNotPaused returns (uint256 remainingFromAllocation) {
        if (amount <= 0) revert InvalidAmount();
        if (amount > allocations[fromCategory]) revert InsufficientAllocation();

        // Subtract from the source category
        allocations[fromCategory] -= amount;
        
        // Add to the destination category
        allocations[toCategory] += amount;

        // Emit event
        emit CrossCategoryTransfer(fromCategory, toCategory, amount);

        // Return remaining allocation of the source category
        return allocations[fromCategory];
    }

    function getRemainingAllocation(AllocationCategory category) external view returns (uint256) {
        return allocations[category];
    }

    function getAllRemainingAllocations() external view returns (uint256[] memory) {
        uint256[] memory remainingAllocations = new uint256[](6);
    
        remainingAllocations[0] = allocations[AllocationCategory.Game];
        remainingAllocations[1] = allocations[AllocationCategory.Rewards];
        remainingAllocations[2] = allocations[AllocationCategory.Ecosystem];
        remainingAllocations[3] = allocations[AllocationCategory.Marketing];
        remainingAllocations[4] = allocations[AllocationCategory.Liquidity];
        remainingAllocations[5] = allocations[AllocationCategory.Team];
        remainingAllocations[6] = allocations[AllocationCategory.Reserved];
        
        return remainingAllocations;
    }

    function updateOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert InvalidAddress();
        if (ITotemPriceOracle(newOracle).getPrice() <= 0) revert InvalidOracleImplementation();
        
        priceOracle = ITotemPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
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
        if (tokenAddress == address(0)) revert InvalidAddress();
        if (tokenAddress == address(this)) revert CannotRecoverToken();
        IERC20(tokenAddress).transfer(owner(), tokenAmount);
    }
}