# TotemBound Contracts

Solidity smart contracts for the TotemBound NFT game ecosystem on Polygon.

## Smart Contracts

- **TotemGame**: Core game mechanics and user management
- **TotemNFT**: ERC721 implementation for Totem collectibles
- **TotemToken**: ERC20 implementation for $TOTEM
- **TotemTrustedForwarder.sol**: Meta-transaction handling
- **TotemProxy**:  Proxy contract for upgrades
- **TotemProxyAdmin**: Admin contract for proxy management
- **TotemRandom**: Chainlink VRF integration for randomness

## Prerequisites
- Node.js (v16+)
- npm or yarn
- Hardhat
- Polygon RPC access

## Security
- All contracts use latest Solidity version
- OpenZeppelin contracts for standard implementations
- Comprehensive test coverage
- Future plans for audit
- Transparent proxy pattern for upgrades
- Time-locked admin functions
- Multi-signature wallet support

## Development Roadmap
- ✅ Core contracts
- ✅ Basic game mechanics
- ✅ NFT metadata and URI handling
- ✅ Meta-transaction support
- ✅ VRF integration
- 🔲 Staking mechanism
- 🔲 Marketplace for trading
- 🔲 Governance features
- 🔲 Advanced game mechanics

## Installation
1. Clone the repository:
```bash
git clone https://github.com/totembound/totem-contracts.git
cd totem-contracts
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
Review the hardhat.config.ts for localhost deployment.
```bash
cp .env.example .env
```

4. Set up environment variables for testnet:
```plaintext
PRIVATE_KEY=your_developer_private_key
POLYGON_AMOY_RPC_URL=your_polygon_rpc
```

## Development

1. Compile contracts
```bash
npx hardhat compile
```

2. Run tests:
```bash
npx hardhat test
```

3. Deploy contracts:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

## Contract Verification

### Verify contracts locally:
```bash
npx hardhat run scripts/verify.ts --network localhost
```

### Verify contracts on PolygonScan:
```bash
npx hardhat verify --network polygon CONTRACT_ADDRESS CONSTRUCTOR_ARGS
```

## Check stats on Users and Totems:
```bash
npx hardhat run scripts/stats.ts --network localhost
```
## Chainlink VRF Setup Instructions
1. Create VRF subscription on Chainlink website
2. Fund subscription with LINK tokens
3. Add consumer contract to subscription
4. Configure environment variables:
```plaintext
CHAINLINK_VRF_COORDINATOR=xxx
CHAINLINK_SUBSCRIPTION_ID=xxx
CHAINLINK_KEY_HASH=xxx
```

## Project Structure
```plaintext
contracts/             # Core game contracts
deployments/           # Output for contract addresses
docs/                  # Specification doc and diagrams
scripts/               # Deployment and verification scripts
test/                  # Contract tests
```
