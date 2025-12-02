// SPDX-License-Identifier: BUSL-1.1
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @custom:security-contact security@aro.media
/**
 * @author  Aro Media Dev Lab.
 * @title   Aro Media Access Manager.
 * @dev     Report Any Vulnerabilities to security@aro.media.
 * @notice  Centralized access control manager for all Aro Media contracts, owned by the MultiSig.
 */
contract AroMediaAccessManager is AccessManager, Ownable {
    constructor(address multiSigOwner) AccessManager(msg.sender) Ownable(multiSigOwner) {}
}
