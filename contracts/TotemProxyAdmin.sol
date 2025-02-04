// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ProxyAdmin } from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title TotemProxyAdmin
 * @dev This is the admin contract for the proxy, capable of upgrading the implementation
 */
contract TotemProxyAdmin is ProxyAdmin {
    constructor(address owner) ProxyAdmin(owner) {}
}
