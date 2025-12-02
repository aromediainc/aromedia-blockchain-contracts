// SPDX-License-Identifier: BUSL-1.1
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {AbstractSigner} from "@openzeppelin/contracts/utils/cryptography/signers/AbstractSigner.sol";
import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {AccountERC7579} from "@openzeppelin/contracts/account/extensions/draft-AccountERC7579.sol";
import {AccountERC7579Hooked} from "@openzeppelin/contracts/account/extensions/draft-AccountERC7579Hooked.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {ERC7739} from "@openzeppelin/contracts/utils/cryptography/signers/draft-ERC7739.sol";
import {MultiSignerERC7913} from "@openzeppelin/contracts/utils/cryptography/signers/MultiSignerERC7913.sol";
import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";

/// @custom:security-contact security@aro.media
/**
 * @author  Aro Media Dev Lab.
 * @title   Aro Media Inc Multi-Signature Smart Contract Wallet.
 * @dev     Report Any Vulnerabilities to security@aro.media.
 * @notice  A Multi-Signature Smart Contract Wallet for Aro Media Inc.
 */
contract AroMediaIncMultiSig is Account, EIP712, ERC7739, AccountERC7579Hooked, MultiSignerERC7913, ERC721Holder, ERC1155Holder {
    constructor(bytes[] memory signers, uint64 threshold)
        EIP712("AroMediaIncMultiSig", "1")
        MultiSignerERC7913(signers, threshold)
    {}

    function isValidSignature(bytes32 hash, bytes calldata signature)
        public
        view
        override(AccountERC7579, ERC7739)
        returns (bytes4)
    {
        // ERC-7739 can return the ERC-1271 magic value, 0xffffffff (invalid) or 0x77390001 (detection).
        // If the returned value is 0xffffffff, fallback to ERC-7579 validation.
        bytes4 erc7739magic = ERC7739.isValidSignature(hash, signature);
        return erc7739magic == bytes4(0xffffffff) ? AccountERC7579.isValidSignature(hash, signature) : erc7739magic;
    }

    function addSigners(bytes[] memory signers) public onlyEntryPointOrSelf {
        _addSigners(signers);
    }

    function removeSigners(bytes[] memory signers) public onlyEntryPointOrSelf {
        _removeSigners(signers);
    }

    function setThreshold(uint64 threshold) public onlyEntryPointOrSelf {
        _setThreshold(threshold);
    }

    // The following functions are overrides required by Solidity.

    function _validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, bytes calldata signature)
        internal
        override(Account, AccountERC7579)
        returns (uint256)
    {
        return super._validateUserOp(userOp, userOpHash, signature);
    }

    // IMPORTANT: Make sure MultiSignerERC7913 is more derived than AccountERC7579
    // in the inheritance chain (i.e. contract ... is AccountERC7579, ..., MultiSignerERC7913)
    // to ensure the correct order of function resolution.
    // AccountERC7579 returns false for _rawSignatureValidation
    function _rawSignatureValidation(bytes32 hash, bytes calldata signature)
        internal
        view
        override(MultiSignerERC7913, AbstractSigner, AccountERC7579)
        returns (bool)
    {
        return super._rawSignatureValidation(hash, signature);
    }
}
