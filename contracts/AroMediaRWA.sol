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
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10 ** 18; // 10 million tokens with 18 decimals

    address public forcedTransferManagerContract;

    // Modifier to restrict access to the ForcedTransferManager contract
    modifier onlyForcedTransferManager() {
        require(msg.sender == forcedTransferManagerContract, "Caller is not the ForcedTransferManager");
        _;
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a forced transfer is executed
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address initialAuthority)
        ERC20("AroMediaRWA", "ARO")
        AccessManaged(initialAuthority)
        ERC20Permit("AroMediaRWA")
    {
        // Allow treasury (initialAuthority) on the allowlist before issuing initial shares
        _allowUser(initialAuthority);
        // Issue initial 10M ARO tokens to treasury representing the current authorized shares
        _mint(initialAuthority, INITIAL_SUPPLY);
    }

    // =========================================================================
    // PAUSABLE
    // =========================================================================

    function pause() public restricted {
        _pause();
    }

    function unpause() public restricted {
        _unpause();
    }

    // =========================================================================
    // ISSUANCE
    // =========================================================================

    function issue(address to, uint256 amount) public restricted {
        _mint(to, amount);
    }

    // =========================================================================
    // VOTING CLOCK
    // =========================================================================

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // =========================================================================
    // FREEZABLE
    // =========================================================================

    function freeze(address user, uint256 amount) public restricted {
        _setFrozen(user, amount);
    }

    // =========================================================================
    // SECURITY TOKEN RESTRICTIONS (ALLOWLIST)
    // =========================================================================

    function isUserAllowed(address user) public view override returns (bool) {
        return getRestriction(user) == Restriction.ALLOWED;
    }

    function allowUser(address user) public restricted {
        _allowUser(user);
    }

    function disallowUser(address user) public restricted {
        _resetUser(user);
    }

    // =========================================================================
    // FORCED TRANSFER (ERC-7943 Compatible)
    // =========================================================================

    /// @notice Setter for manager (performed by ROLE_PROTOCOL_ADMIN)
    function setForcedTransferManager(address _newManager) external restricted {
        require(_newManager != address(0), "Invalid address");
        forcedTransferManagerContract = _newManager;
    }

    /**
     * @notice Execute a forced transfer bypassing restrictions
     * @param from Source address to take tokens from
     * @param to Destination address to send tokens to  
     * @param amount Amount of tokens to transfer
     * @dev Only callable by authorized ForcedTransferManager contract.
     *      Bypasses allowlist restrictions on source but validates destination.
     *      Automatically adjusts frozen balance if necessary.
     */
    function forcedTransfer(address from, address to, uint256 amount) external onlyForcedTransferManager {
        require(isUserAllowed(to), "Destination not allowed");

        // Store original restriction state
        Restriction originalRestriction = getRestriction(from);
        bool wasAllowed = isUserAllowed(from);

        // Temporarily allow the source address if not already allowed
        if (!wasAllowed) {
            _setRestriction(from, Restriction.ALLOWED);
        }

        // Handle frozen tokens: adjust if needed
        uint256 currentFrozen = frozen(from);
        uint256 newBalance = balanceOf(from) - amount;
        if (currentFrozen > newBalance) {
            _setFrozen(from, newBalance);
        }

        // Perform the transfer
        _update(from, to, amount);

        // Restore original restriction state
        if (!wasAllowed) {
            _setRestriction(from, originalRestriction);
        }

        emit ForcedTransfer(from, to, amount);
    }

    // =========================================================================
    // OVERRIDES REQUIRED BY SOLIDITY
    // =========================================================================

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
