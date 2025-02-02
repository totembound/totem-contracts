// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// ITotemToken.sol
interface ITotemToken {
    // Custom Errors
    error InvalidAddress();
    error InvalidOracleImplementation();
    error InvalidAmount();
    error InsufficientAllocation();
    error CannotRecoverToken();
    error TokenTransferFailed();

    // Enums
    enum AllocationCategory {
        Game,        // 25% - Gaming infrastructure, player incentives, in-game economy and NFT integrations
        Rewards,     // 15% - Community staking rewards, gameplay achievements, and participation incentives
        Ecosystem,   // 10% - Community grants, developer incentives, integration partners, and dApp expansion
        Liquidity,   // 10% - Initial and ongoing DEX liquidity provision, ensuring stable token trading
        Marketing,   // 15% - Community growth, brand awareness, events, and promotional activities
        Team,        // 20% - Development, operations, and core team incentives
        Reserved     //  5% - Strategic partnerships, future opportunities, and contingency fund
    }

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

    // View Functions
    function TOTAL_SUPPLY() external pure returns (uint256);
    function priceOracle() external view returns (address);
    function getTokenPrice() external view returns (uint256);
    function getLastPriceUpdate() external view returns (uint256);
    function getRemainingAllocation(AllocationCategory category) external view returns (uint256);
    function getAllRemainingAllocations() external view returns (uint256[] memory);
    
    // ERC20 Standard Functions
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // Admin Functions
    function transferAllocation(
        AllocationCategory fromCategory,
        address recipient,
        uint256 amount
    ) external returns (uint256 remainingAllocation);

    function transferBetweenCategories(
        AllocationCategory fromCategory,
        AllocationCategory toCategory,
        uint256 amount
    ) external returns (uint256 remainingFromAllocation);

    function updateOracle(address newOracle) external;
    function pause() external;
    function unpause() external;
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external;
}
