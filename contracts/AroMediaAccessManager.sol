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
 * @notice  Centralized access control manager for all Aro Media contracts, owned by the Company's MultiSig.
 */
contract AroMediaAccessManager is AccessManager, Ownable {
    // =========================================================================
    // ROLE DEFINITIONS
    // =========================================================================
    // Note: Role 0 is ADMIN_ROLE (inherited from AccessManager), mapped to ORG_ADMIN

    /**
     * @notice ORG_ADMIN (Role 0) - Full control
     * @dev Assign/revoke roles, manage global settings, emergency actions.
     *      This is the AccessManager's built-in ADMIN_ROLE.
     */
    uint64 public constant ROLE_ORG_ADMIN = 0;

    /**
     * @notice PROTOCOL_ADMIN (Role 1)
     * @dev Manage protocol parameters, enable/disable features.
     *      No treasury or minting powers.
     */
    uint64 public constant ROLE_PROTOCOL_ADMIN = 1;

    /**
     * @notice TREASURY_CONTROLLER (Role 2)
     * @dev Move/manage protocol funds, handle distributions + transfers.
     *      No role changes or protocol edits.
     */
    uint64 public constant ROLE_TREASURY_CONTROLLER = 2;

    /**
     * @notice MARKET_MAKER / LIQUIDITY_MANAGER (Role 3)
     * @dev Manage liquidity, run buyback/sellback logic.
     *      No mint/burn or role changes.
     */
    uint64 public constant ROLE_MARKET_MAKER = 3;

    /**
     * @notice MINTER (Role 4)
     * @dev Mint ERC-20/721/1155 tokens. Scoped to specific assets.
     */
    uint64 public constant ROLE_MINTER = 4;

    /**
     * @notice BURNER (Role 5)
     * @dev Burn tokens. Separate from Minter for safety.
     */
    uint64 public constant ROLE_BURNER = 5;

    /**
     * @notice PAUSER / SAFETY_OFFICER (Role 6)
     * @dev Pause/unpause contracts. No mint, burn, or treasury access.
     */
    uint64 public constant ROLE_PAUSER = 6;

    /**
     * @notice OPERATOR (Role 7)
     * @dev Routine ops (lists, metadata, keys). No admin, treasury, or mint powers.
     */
    uint64 public constant ROLE_OPERATOR = 7;

    /**
     * @notice AUDITOR / COMPLIANCE_VIEW (Role 8)
     * @dev Read-only access. No state-changing rights.
     */
    uint64 public constant ROLE_AUDITOR = 8;

    /**
     * @notice INTEGRATION_BOT / SERVICE_ACCOUNT (Role 9)
     * @dev Very limited, scoped permissions. Automation + scheduled tasks only.
     */
    uint64 public constant ROLE_INTEGRATION_BOT = 9;

    /**
     * @notice Total number of defined roles
     */
    uint64 public constant ROLE_COUNT = 10;

    // =========================================================================
    // ROLE LABELING
    // =========================================================================

    /**
     * @notice Get a human-readable label for a role ID
     * @param roleId The role ID to get the label for
     * @return The string label for the role, or "UNKNOWN" if not defined
     */
    function getRoleLabel(uint64 roleId) public pure returns (string memory) {
        if (roleId == ROLE_ORG_ADMIN) return "ORG_ADMIN";
        if (roleId == ROLE_PROTOCOL_ADMIN) return "PROTOCOL_ADMIN";
        if (roleId == ROLE_TREASURY_CONTROLLER) return "TREASURY_CONTROLLER";
        if (roleId == ROLE_MARKET_MAKER) return "MARKET_MAKER";
        if (roleId == ROLE_MINTER) return "MINTER";
        if (roleId == ROLE_BURNER) return "BURNER";
        if (roleId == ROLE_PAUSER) return "PAUSER";
        if (roleId == ROLE_OPERATOR) return "OPERATOR";
        if (roleId == ROLE_AUDITOR) return "AUDITOR";
        if (roleId == ROLE_INTEGRATION_BOT) return "INTEGRATION_BOT";
        return "UNKNOWN";
    }

    /**
     * @notice Get all role IDs with their labels
     * @return roleIds Array of all defined role IDs
     * @return labels Array of corresponding role labels
     */
    function getAllRoles() public pure returns (uint64[] memory roleIds, string[] memory labels) {
        roleIds = new uint64[](ROLE_COUNT);
        labels = new string[](ROLE_COUNT);
        
        roleIds[0] = ROLE_ORG_ADMIN;
        roleIds[1] = ROLE_PROTOCOL_ADMIN;
        roleIds[2] = ROLE_TREASURY_CONTROLLER;
        roleIds[3] = ROLE_MARKET_MAKER;
        roleIds[4] = ROLE_MINTER;
        roleIds[5] = ROLE_BURNER;
        roleIds[6] = ROLE_PAUSER;
        roleIds[7] = ROLE_OPERATOR;
        roleIds[8] = ROLE_AUDITOR;
        roleIds[9] = ROLE_INTEGRATION_BOT;
        
        for (uint64 i = 0; i < ROLE_COUNT; i++) {
            labels[i] = getRoleLabel(roleIds[i]);
        }
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address multiSigOwner) AccessManager(multiSigOwner) Ownable(multiSigOwner) {
        // Grant the MultiSig owner the ORG_ADMIN role (ADMIN_ROLE)
        // Note: ADMIN_ROLE is automatically granted to the initial admin in AccessManager
        
        // Set up role hierarchy: ORG_ADMIN can manage all other roles
        _setRoleAdmin(ROLE_PROTOCOL_ADMIN, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_TREASURY_CONTROLLER, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_MARKET_MAKER, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_MINTER, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_BURNER, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_PAUSER, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_OPERATOR, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_AUDITOR, ROLE_ORG_ADMIN);
        _setRoleAdmin(ROLE_INTEGRATION_BOT, ROLE_ORG_ADMIN);
    }

    // =========================================================================
    // ROLE WIRING - RWA TOKEN (ERC-20)
    // =========================================================================

    /**
     * @notice Configure function permissions for the AroMediaRWA token contract
     * @param rwaToken Address of the AroMediaRWA contract
     * @dev Sets up the following role -> function mappings:
     *      - ROLE_MINTER: mint
     *      - ROLE_PAUSER: pause, unpause
     *      - ROLE_OPERATOR: allowUser, disallowUser, freeze
     */
    function wireRWAToken(address rwaToken) external onlyOwner {
        // Minting: ROLE_MINTER
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("mint(address,uint256)")), ROLE_MINTER);

        // Pausing: ROLE_PAUSER
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("pause()")), ROLE_PAUSER);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("unpause()")), ROLE_PAUSER);

        // User allowlist management: ROLE_OPERATOR
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("allowUser(address)")), ROLE_OPERATOR);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("disallowUser(address)")), ROLE_OPERATOR);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("freeze(address,uint256)")), ROLE_OPERATOR);
    }

    // =========================================================================
    // ROLE WIRING - ASSETS REGISTRY (ERC-721)
    // =========================================================================

    /**
     * @notice Configure function permissions for the AroMediaAssetsRegistry contract
     * @param assetsRegistry Address of the AroMediaAssetsRegistry contract
     * @dev Sets up the following role -> function mappings:
     *      - ROLE_MINTER: safeMint
     *      - ROLE_PAUSER: pause, unpause
     */
    function wireAssetsRegistry(address assetsRegistry) external onlyOwner {
        // Minting: ROLE_MINTER
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("safeMint(address,string)")), ROLE_MINTER);

        // Pausing: ROLE_PAUSER
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("pause()")), ROLE_PAUSER);
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("unpause()")), ROLE_PAUSER);
    }

    // =========================================================================
    // BATCH WIRING
    // =========================================================================

    /**
     * @notice Configure all managed contracts in a single transaction
     * @param rwaToken Address of the AroMediaRWA contract
     * @param assetsRegistry Address of the AroMediaAssetsRegistry contract
     */
    function wireAllContracts(address rwaToken, address assetsRegistry) external onlyOwner {
        // Wire RWA Token - Minting
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("mint(address,uint256)")), ROLE_MINTER);
        
        // Wire RWA Token - Pausing
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("pause()")), ROLE_PAUSER);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("unpause()")), ROLE_PAUSER);
        
        // Wire RWA Token - Operator functions
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("allowUser(address)")), ROLE_OPERATOR);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("disallowUser(address)")), ROLE_OPERATOR);
        _setTargetFunctionRole(rwaToken, bytes4(keccak256("freeze(address,uint256)")), ROLE_OPERATOR);

        // Wire Assets Registry - Minting
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("safeMint(address,string)")), ROLE_MINTER);
        
        // Wire Assets Registry - Pausing
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("pause()")), ROLE_PAUSER);
        _setTargetFunctionRole(assetsRegistry, bytes4(keccak256("unpause()")), ROLE_PAUSER);
    }
}
