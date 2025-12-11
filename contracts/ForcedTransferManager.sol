// SPDX-License-Identifier: BUSL-1.1
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {IAccessManager} from "@openzeppelin/contracts/access/manager/IAccessManager.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @notice Interface for the RWA token's forced transfer capability
 */
interface IForcedTransferable {
    function forcedTransfer(address from, address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function isUserAllowed(address user) external view returns (bool);
}

/// @custom:security-contact security@aro.media
/**
 * @author  Aro Media Dev Lab.
 * @title   Forced Transfer Manager.
 * @dev     Report Any Vulnerabilities to security@aro.media.
 * @notice  Manages regulatory-compliant forced transfers for the ARO Security Token.
 *          Requires dossier NFT proof and three-party approval workflow.
 */
contract ForcedTransferManager is AccessManaged {

    // =========================================================================
    // TYPES
    // =========================================================================

    /**
     * @notice Status of a forced transfer request
     */
    enum ForcedTransferStatus {
        PENDING,
        APPROVED,
        EXECUTED,
        CANCELLED
    }

    /**
     * @notice Forced transfer request structure with multi-role approval workflow
     * @dev Requires dossier NFT as verifiable proof, plus three-party approval
     */
    struct ForcedTransferRequest {
        address from;                    // Source address (tokens taken from)
        address to;                      // Destination address (tokens sent to)
        uint256 amount;                  // Amount of tokens to transfer
        uint256 dossierTokenId;          // NFT token ID from AroMediaAssetsRegistry (proof/dossier)
        address initiator;               // TREASURY_CONTROLLER who initiated
        uint256 initiatedAt;             // Timestamp of initiation
        bool treasuryApproval;           // TREASURY_CONTROLLER signoff
        bool auditorApproval;            // AUDITOR signoff
        bool orgAdminApproval;           // ORG_ADMIN final approval
        ForcedTransferStatus status;     // Current status
        string reason;                   // Reason/cause for forced transfer
    }

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice The RWA token contract
    IForcedTransferable public rwaToken;

    /// @notice The Assets Registry contract for dossier verification
    IERC721 public assetsRegistry;

    /// @notice Counter for forced transfer request IDs
    uint256 private _nextRequestId;

    /// @notice Mapping of request ID to ForcedTransferRequest
    mapping(uint256 => ForcedTransferRequest) private _requests;

    /// @notice Mapping to track which dossier NFTs have been used
    mapping(uint256 => bool) private _usedDossiers;

    // =========================================================================
    // ROLE CONSTANTS (Must match AroMediaAccessManager)
    // =========================================================================

    uint64 private constant ROLE_ORG_ADMIN = 0;
    uint64 private constant ROLE_TREASURY_CONTROLLER = 2;
    uint64 private constant ROLE_AUDITOR = 8;

    // =========================================================================
    // EVENTS
    // =========================================================================

    /// @notice Emitted when a forced transfer request is initiated
    event ForcedTransferInitiated(
        uint256 indexed requestId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 dossierTokenId,
        address initiator,
        string reason
    );

    /// @notice Emitted when an approval is given for a forced transfer
    event ForcedTransferApproval(
        uint256 indexed requestId,
        address indexed approver,
        string role
    );

    /// @notice Emitted when a forced transfer is executed
    event ForcedTransferExecuted(
        uint256 indexed requestId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 dossierTokenId
    );

    /// @notice Emitted when a forced transfer request is cancelled
    event ForcedTransferCancelled(
        uint256 indexed requestId,
        address indexed canceller
    );

    /// @notice Emitted when the RWA token is set
    event RWATokenSet(address indexed token);

    /// @notice Emitted when the assets registry is set
    event AssetsRegistrySet(address indexed registry);

    // =========================================================================
    // ERRORS
    // =========================================================================

    /// @notice Request does not exist
    error RequestNotFound(uint256 requestId);

    /// @notice Request is not in pending status
    error RequestNotPending(uint256 requestId);

    /// @notice Request is not fully approved
    error RequestNotFullyApproved(uint256 requestId);

    /// @notice Dossier NFT does not exist
    error DossierNotFound(uint256 tokenId);

    /// @notice Dossier NFT has already been used
    error DossierAlreadyUsed(uint256 tokenId);

    /// @notice Contract not configured
    error NotConfigured(string component);

    /// @notice Caller does not have required role
    error UnauthorizedRole(address caller, uint64 requiredRole);

    /// @notice Cannot approve own initiation (separation of duties)
    error CannotSelfApprove();

    /// @notice Approval already given by this role
    error AlreadyApproved(string role);

    /// @notice Invalid address
    error InvalidAddress(string param);

    /// @notice Insufficient balance for forced transfer
    error InsufficientBalance(address from, uint256 amount, uint256 balance);

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address initialAuthority) AccessManaged(initialAuthority) {}

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * @notice Set the RWA token contract address
     * @param token Address of the AroMediaRWA contract
     */
    function setRWAToken(address token) external restricted {
        if (token == address(0)) revert InvalidAddress("token");
        rwaToken = IForcedTransferable(token);
        emit RWATokenSet(token);
    }

    /**
     * @notice Set the Assets Registry contract address
     * @param registry Address of the AroMediaAssetsRegistry contract
     */
    function setAssetsRegistry(address registry) external restricted {
        if (registry == address(0)) revert InvalidAddress("registry");
        assetsRegistry = IERC721(registry);
        emit AssetsRegistrySet(registry);
    }

    /**
     * @notice Configure both contracts in a single call
     * @param token Address of the AroMediaRWA contract
     * @param registry Address of the AroMediaAssetsRegistry contract
     */
    function configure(address token, address registry) external restricted {
        if (token == address(0)) revert InvalidAddress("token");
        if (registry == address(0)) revert InvalidAddress("registry");
        rwaToken = IForcedTransferable(token);
        assetsRegistry = IERC721(registry);
        emit RWATokenSet(token);
        emit AssetsRegistrySet(registry);
    }

    // =========================================================================
    // INITIATION
    // =========================================================================

    /**
     * @notice Initiate a forced transfer request with dossier proof
     * @param from Source address to take tokens from
     * @param to Destination address to send tokens to
     * @param amount Amount of tokens to transfer
     * @param dossierTokenId Token ID of the dossier NFT from AroMediaAssetsRegistry
     * @param reason Human-readable reason/cause for the forced transfer
     * @return requestId The ID of the created forced transfer request
     * @dev Only TREASURY_CONTROLLER can initiate. Dossier NFT must exist and not be previously used.
     */
    function initiate(
        address from,
        address to,
        uint256 amount,
        uint256 dossierTokenId,
        string calldata reason
    ) external restricted returns (uint256 requestId) {
        // Verify configuration
        if (address(rwaToken) == address(0)) revert NotConfigured("rwaToken");
        if (address(assetsRegistry) == address(0)) revert NotConfigured("assetsRegistry");

        // Verify caller has TREASURY_CONTROLLER role
        _checkRole(msg.sender, ROLE_TREASURY_CONTROLLER);

        // Verify dossier NFT exists
        try assetsRegistry.ownerOf(dossierTokenId) returns (address) {
            // Dossier exists
        } catch {
            revert DossierNotFound(dossierTokenId);
        }

        // Verify dossier hasn't been used before
        if (_usedDossiers[dossierTokenId]) {
            revert DossierAlreadyUsed(dossierTokenId);
        }

        // Verify destination is valid
        if (to == address(0)) {
            revert InvalidAddress("to");
        }

        // Verify source has sufficient balance
        uint256 sourceBalance = rwaToken.balanceOf(from);
        if (sourceBalance < amount) {
            revert InsufficientBalance(from, amount, sourceBalance);
        }

        // Mark dossier as used
        _usedDossiers[dossierTokenId] = true;

        // Create request
        requestId = _nextRequestId++;
        _requests[requestId] = ForcedTransferRequest({
            from: from,
            to: to,
            amount: amount,
            dossierTokenId: dossierTokenId,
            initiator: msg.sender,
            initiatedAt: block.timestamp,
            treasuryApproval: false,
            auditorApproval: false,
            orgAdminApproval: false,
            status: ForcedTransferStatus.PENDING,
            reason: reason
        });

        emit ForcedTransferInitiated(
            requestId,
            from,
            to,
            amount,
            dossierTokenId,
            msg.sender,
            reason
        );
    }

    // =========================================================================
    // APPROVALS
    // =========================================================================

    /**
     * @notice Treasury Controller signoff for forced transfer
     * @param requestId The ID of the forced transfer request
     * @dev Only TREASURY_CONTROLLER can call. Cannot be the same as initiator.
     */
    function approveTreasury(uint256 requestId) external restricted {
        ForcedTransferRequest storage request = _getValidRequest(requestId);
        _checkRole(msg.sender, ROLE_TREASURY_CONTROLLER);

        // Separation of duties: approver cannot be initiator
        if (msg.sender == request.initiator) {
            revert CannotSelfApprove();
        }

        if (request.treasuryApproval) {
            revert AlreadyApproved("TREASURY_CONTROLLER");
        }

        request.treasuryApproval = true;
        emit ForcedTransferApproval(requestId, msg.sender, "TREASURY_CONTROLLER");
        
        _checkAndUpdateApprovalStatus(requestId);
    }

    /**
     * @notice Auditor signoff for forced transfer
     * @param requestId The ID of the forced transfer request
     * @dev Only AUDITOR can call.
     */
    function approveAuditor(uint256 requestId) external restricted {
        ForcedTransferRequest storage request = _getValidRequest(requestId);
        _checkRole(msg.sender, ROLE_AUDITOR);

        if (request.auditorApproval) {
            revert AlreadyApproved("AUDITOR");
        }

        request.auditorApproval = true;
        emit ForcedTransferApproval(requestId, msg.sender, "AUDITOR");
        
        _checkAndUpdateApprovalStatus(requestId);
    }

    /**
     * @notice Org Admin final approval for forced transfer
     * @param requestId The ID of the forced transfer request
     * @dev Only ORG_ADMIN can call.
     */
    function approveOrgAdmin(uint256 requestId) external restricted {
        ForcedTransferRequest storage request = _getValidRequest(requestId);
        _checkRole(msg.sender, ROLE_ORG_ADMIN);

        if (request.orgAdminApproval) {
            revert AlreadyApproved("ORG_ADMIN");
        }

        request.orgAdminApproval = true;
        emit ForcedTransferApproval(requestId, msg.sender, "ORG_ADMIN");
        
        _checkAndUpdateApprovalStatus(requestId);
    }

    // =========================================================================
    // EXECUTION
    // =========================================================================

    /**
     * @notice Execute a fully approved forced transfer
     * @param requestId The ID of the forced transfer request
     * @dev Only TREASURY_CONTROLLER can execute. All three approvals must be complete.
     */
    function execute(uint256 requestId) external restricted {
        ForcedTransferRequest storage request = _requests[requestId];
        
        // Verify request exists
        if (request.initiator == address(0)) {
            revert RequestNotFound(requestId);
        }

        // Verify request is fully approved
        if (request.status != ForcedTransferStatus.APPROVED) {
            revert RequestNotFullyApproved(requestId);
        }

        // Verify caller has TREASURY_CONTROLLER role
        _checkRole(msg.sender, ROLE_TREASURY_CONTROLLER);

        // Verify destination is still allowed
        if (!rwaToken.isUserAllowed(request.to)) {
            revert InvalidAddress("to");
        }

        // Mark as executed before transfer (reentrancy protection)
        request.status = ForcedTransferStatus.EXECUTED;

        // Call the token's forcedTransfer function
        rwaToken.forcedTransfer(request.from, request.to, request.amount);

        emit ForcedTransferExecuted(
            requestId,
            request.from,
            request.to,
            request.amount,
            request.dossierTokenId
        );
    }

    /**
     * @notice Cancel a pending forced transfer request
     * @param requestId The ID of the forced transfer request
     * @dev Only ORG_ADMIN can cancel.
     */
    function cancel(uint256 requestId) external restricted {
        ForcedTransferRequest storage request = _requests[requestId];
        
        // Verify request exists
        if (request.initiator == address(0)) {
            revert RequestNotFound(requestId);
        }

        // Verify request is pending or approved (not executed/cancelled)
        if (request.status == ForcedTransferStatus.EXECUTED || 
            request.status == ForcedTransferStatus.CANCELLED) {
            revert RequestNotPending(requestId);
        }

        // Verify caller has ORG_ADMIN role
        _checkRole(msg.sender, ROLE_ORG_ADMIN);

        // Mark as cancelled
        request.status = ForcedTransferStatus.CANCELLED;

        // Note: Dossier remains marked as used to prevent replay
        
        emit ForcedTransferCancelled(requestId, msg.sender);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Get details of a forced transfer request
     * @param requestId The ID of the forced transfer request
     * @return request The full ForcedTransferRequest struct
     */
    function getRequest(uint256 requestId) 
        external 
        view 
        returns (ForcedTransferRequest memory request) 
    {
        request = _requests[requestId];
        if (request.initiator == address(0)) {
            revert RequestNotFound(requestId);
        }
    }

    /**
     * @notice Get the total number of forced transfer requests
     * @return count The total count of requests created
     */
    function getRequestCount() external view returns (uint256 count) {
        return _nextRequestId;
    }

    /**
     * @notice Check if a dossier NFT has been used
     * @param dossierTokenId The token ID to check
     * @return used True if the dossier has been used
     */
    function isDossierUsed(uint256 dossierTokenId) external view returns (bool used) {
        return _usedDossiers[dossierTokenId];
    }

    /**
     * @notice Check if a forced transfer request is fully approved
     * @param requestId The ID of the forced transfer request
     * @return approved True if all three approvals are complete
     */
    function isFullyApproved(uint256 requestId) external view returns (bool approved) {
        ForcedTransferRequest storage request = _requests[requestId];
        return request.treasuryApproval && 
               request.auditorApproval && 
               request.orgAdminApproval;
    }

    // =========================================================================
    // INTERNAL FUNCTIONS
    // =========================================================================

    /**
     * @dev Check caller has specific role via AccessManager
     */
    function _checkRole(address account, uint64 roleId) internal view {
        (bool isMember, ) = IAccessManager(authority()).hasRole(roleId, account);
        if (!isMember) {
            revert UnauthorizedRole(account, roleId);
        }
    }

    /**
     * @dev Get valid pending request or revert
     */
    function _getValidRequest(uint256 requestId) 
        internal 
        view 
        returns (ForcedTransferRequest storage request) 
    {
        request = _requests[requestId];
        
        if (request.initiator == address(0)) {
            revert RequestNotFound(requestId);
        }
        
        if (request.status != ForcedTransferStatus.PENDING) {
            revert RequestNotPending(requestId);
        }
    }

    /**
     * @dev Check if all approvals are complete and update status
     */
    function _checkAndUpdateApprovalStatus(uint256 requestId) internal {
        ForcedTransferRequest storage request = _requests[requestId];
        
        if (request.treasuryApproval && 
            request.auditorApproval && 
            request.orgAdminApproval) {
            request.status = ForcedTransferStatus.APPROVED;
        }
    }
}
