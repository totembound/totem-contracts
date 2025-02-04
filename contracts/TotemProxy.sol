// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title TotemProxy
 * @dev This is the proxy contract that delegates calls to the implementation
 */
contract TotemProxy is TransparentUpgradeableProxy {
    constructor(
        address _logic,        // Initial implementation address
        address _admin,        // ProxyAdmin address
        bytes memory _data     // Initialization data for implementation
    ) TransparentUpgradeableProxy(_logic, _admin, _data) {}
}
