// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BWillToken (BWILL)
/// @notice Demo ERC-20 asset used to make on-chain inheritance distribution
///         concretely observable during the academic demonstration. This is
///         NOT a real-world currency or security - it exists purely so the
///         InheritanceManager contract has a fungible asset it can split
///         between beneficiaries according to a will's allocation table.
/// @dev Minting is restricted to accounts holding MINTER_ROLE (the deployer
///      and, in local demo scripts, the faucet script) so the token supply
///      stays bounded and auditable.
contract BWillToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    constructor(address admin) ERC20("BlockWill Demo Token", "BWILL") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _mint(admin, INITIAL_SUPPLY);
    }

    /// @notice Mint additional demo tokens (used only by seed/faucet scripts).
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
