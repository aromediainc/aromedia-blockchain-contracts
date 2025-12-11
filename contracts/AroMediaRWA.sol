// SPDX-License-Identifier: BUSL-1.1
// Compatible with OpenZeppelin Contracts ^5.5.0 and Community Contracts commit b0ddd27
pragma solidity ^0.8.27;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Freezable} from "lib/openzeppelin-community-contracts/token/ERC20/extensions/ERC20Freezable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Restricted} from "lib/openzeppelin-community-contracts/token/ERC20/extensions/ERC20Restricted.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @custom:security-contact security@aro.media
/**
 * @author  Aro Media Dev Lab.
 * @title   Aro Media RWA Security Token.
 * @dev     Report Any Vulnerabilities to security@aro.media.
 * @notice  The Global Security Token Powering the ARO Media Private, Asset-Backed Ecosystem.
 */
contract AroMediaRWA is ERC20, ERC20Burnable, ERC20Pausable, AccessManaged, ERC1363, ERC20Permit, ERC20Votes, ERC20Freezable, ERC20Restricted {

    constructor(address initialAuthority)
        ERC20("AroMediaRWA", "ARO")
        AccessManaged(initialAuthority)
        ERC20Permit("AroMediaRWA")
    {}

    function pause() public restricted {
        _pause();
    }

    function unpause() public restricted {
        _unpause();
    }

    function mint(address to, uint256 amount) public restricted {
        _mint(to, amount);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function freeze(address user, uint256 amount) public restricted {
        _setFrozen(user, amount);
    }

    function isUserAllowed(address user) public view override returns (bool) {
        return getRestriction(user) == Restriction.ALLOWED;
    }

    function allowUser(address user) public restricted {
        _allowUser(user);
    }

    function disallowUser(address user) public restricted {
        _resetUser(user);
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable, ERC20Votes, ERC20Freezable, ERC20Restricted)
    {
        super._update(from, to, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1363)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
