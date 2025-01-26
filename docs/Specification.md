# TotemBound Contract Specification
This specification outlines the design and functionality of the Solidity contracts required for the TotemBound ecosystem, including support for gasless transactions, upgradeable architecture, and essential gameplay mechanics. The system consists of four main components.

## 1. Components
1. TotemToken:
    - An ERC-20 token representing the in-game currency ($TOTEM).
    - Total supply: 1 billion tokens.
    - Use cases:
      - Initial reward for users during signup.
      - Spending tokens for in-game actions like feeding and training.
      - Purchasing additional tokens using POL.
      - Purchasing on DEX, includes basic functionality for transferring, approving, and interacting with other contracts.
2. TotemNFT:
    - An ERC-721 token representing dynamic and evolving NFTs (e.g., animals).
    - Attributes include happiness, experience, and stage.
    - Stages evolve over time based on experience thresholds.
3. TotemGame:
    - Manages gameplay logic, including feeding, training, and signup rewards.
    - Facilitates token spending for in-game actions.
    - Integrates with TotemTrustedForwarder for gasless transactions.
4. TotemTrustedForwarder:
    - Handles meta-transactions for gasless interactions.
    - Pays gas fees for users and validates signed requests.

## 2. TotemToken Contract Specification
### Standards:
  - Implements ERC-20.
  - Fixed supply of 1 billion tokens.
### Token Allocation:
  - Initial Supply: 1,000,000,000 tokens.
    - Gameplay Rewards: 50% (500,000,000 tokens).
    - Team Allocation: 20% (200,000,000 tokens).
    - Marketing and Partnerships: 15% (150,000,000 tokens).
    - Liquidity Pool: 10% (100,000,000 tokens).
    - Reserve: 5% (50,000,000 tokens).
### Functionality:
1. Buy Tokens:
    - Users can purchase tokens using POL.
    - Price per token is fixed (e.g., 0.01 POL per token).
2. Withdraw POL:
    - Allows the owner to withdraw accumulated POL from token sales.

## 3. TotemNFT Contract Specification
### Standards:
  - Implements ERC-721 with Enumerable and Metadata extensions.
### Attributes:
  - happiness: Tracks the current happiness level.
  - experience: Tracks accumulated experience points.
  - stage: Indicates the current evolution stage (0 to 4).
### Functionality:
1. Minting:
    - Allows the contract owner to mint new NFTs to users.
    - Automatically initializes attributes (e.g., happiness = 100).
2. Evolving:
    - Users can evolve their NFTs by reaching experience thresholds.
    - Each stage requires twice the experience of the previous stage.
    - the tokenURI will be updated each stage for new image and metadata.
3. Burning: (future)
    - Trade up feature, e.g. any 3 common for new uncommon stage 0, any 3 uncommon for new rare stage 0.

## 4. TotemGame Contract Specification
### Standards:
  - Upgradeable contract (UUPS proxy).
### Functionality:
1. Signup Reward:
    - New users receive 2,000 $TOTEM upon signing up.
2. Gameplay Actions:
    - Feeding:
      - Cost: 10 $TOTEM.
      - Increases happiness by +10.
      - Can be performed once per day (24-hour cooldown).
    - Training:
      - Cost: 20 $TOTEM.
      - Increases experience by +50.
      - Reduces happiness by -10.
3. Gasless Transactions:
    - Integrates with TotemTrustedForwarder for validating meta-transactions.

## 5. TotemTrustedForwarder Contract Specification
### Standards:
  - Implements OpenZeppelin’s MinimalForwarder.
### Functionality:
1. Meta-Transaction Support:
    - Validates user-signed requests.
    - Relays transactions to the target contract.
2. Gas Payment:
    - Uses its own POL balance to pay for relayed transactions.
3. Reimbursement Mechanism:
    - Optionally reimburses relayer fees in $TOTEM tokens.

## 6. Gasless Transaction Flow
1. User Interaction:
    - The user signs a transaction off-chain.
    - The frontend sends the signed transaction to TotemTrustedForwarder.
2. Relayer Action:
    - The forwarder validates the user’s signature.
    - Pays gas fees to execute the transaction on the blockchain.
3. Game Contract:
    - Executes the gameplay logic (e.g., feeding, training) as if called by the user.

## 7. Upgradeable Proxy Design
### Transparent Proxy:
  - Use OpenZeppelin’s TransparentUpgradeableProxy for upgradeable contracts.
### Contracts to Upgrade:
  - TotemGame.
  - Optionally, TotemTrustedForwarder.
### Proxy Admin:
  - Deploy a ProxyAdmin contract to manage upgrades.

## 8. Deployment Plan
1. Deploy Contracts:
    - Deploy TotemToken with 1 billion tokens.
    - Deploy TotemNFT for dynamic animal NFTs.
    - Deploy TotemGame via proxy.
    - Deploy TotemTrustedForwarder.
2. Set Roles and Ownership:
    - Assign admin roles for upgradeable contracts.
    - Distribute initial token supply.
3. Integrate Frontend:
    - Connect wallet for signup and token purchases.
    - Implement gasless transactions using TotemTrustedForwarder.

## 9. Technical Details
### Sample Solidity Implementation: TotemToken
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TotemToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens
    constructor() ERC20("TotemToken", "TOTEM") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
```

## 10. Integration Points
  - Frontend:
    - Use Web3.js or ethers.js to interact with the contracts.
    - Implement off-chain signing for gasless transactions.
  - Relayer:
    - Set up a relayer to handle meta-transactions (optional).
  - Testing:
    - Test all gameplay functions (feeding, training) locally and on testnets (e.g., Polygon Amoy).
