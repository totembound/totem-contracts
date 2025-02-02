// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title TotemProxyAdmin
 * @dev This is the admin contract for the proxy, capable of upgrading the implementation
 */
contract TotemProxyAdmin is ProxyAdmin {
    constructor(address owner) ProxyAdmin(owner) {}
}

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
