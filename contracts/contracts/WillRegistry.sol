// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title WillRegistry
/// @notice Source of truth for a digital will's on-chain lifecycle. Stores
///         only the minimum data needed for integrity and auditability -
///         a content hash, the creator, witness signatures, status, and
///         timestamps. The full legal document and personal details are
///         intentionally kept off-chain (see docs/architecture.md).
/// @dev Status transitions are enforced here; other contracts
///      (InheritanceManager, ExecutorManager) are granted MANAGER_ROLE so
///      they can drive transitions that originate from their own workflows
///      (e.g. marking a will EXECUTED once distribution completes).
contract WillRegistry is AccessControl, Pausable {
    bytes32 public constant AUTHORITY_ROLE = keccak256("AUTHORITY_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint256 public constant MIN_WITNESSES = 2;

    enum Status {
        DRAFT,
        ACTIVE,
        REVOKED,
        DEATH_VERIFICATION_PENDING,
        VERIFIED,
        INHERITANCE_IN_PROGRESS,
        EXECUTED,
        DISPUTED
    }

    struct Will {
        address testator;
        bytes32 documentHash;
        Status status;
        uint32 version;
        uint40 createdAt;
        uint40 updatedAt;
        uint8 witnessCount;
        uint8 witnessSignedCount;
        bool exists;
    }

    mapping(bytes32 => Will) public wills;
    mapping(bytes32 => address[]) private _witnesses;
    mapping(bytes32 => mapping(address => bool)) public isWitnessFor;
    mapping(bytes32 => mapping(address => bool)) public hasSigned;
    mapping(bytes32 => bytes32) public deathCertificateHash;

    event WillCreated(bytes32 indexed willId, address indexed testator, bytes32 documentHash, uint256 timestamp);
    event WitnessAdded(bytes32 indexed willId, address indexed witness);
    event WitnessSigned(bytes32 indexed willId, address indexed witness, uint256 timestamp);
    event WillDocumentUpdated(bytes32 indexed willId, bytes32 newHash, uint32 version);
    event WillFinalized(bytes32 indexed willId, uint256 timestamp);
    event WillRevoked(bytes32 indexed willId, address indexed by, uint256 timestamp);
    event DeathVerificationRequested(bytes32 indexed willId, address indexed requestedBy, uint256 timestamp);
    event DeathVerified(bytes32 indexed willId, address indexed authority, bytes32 certificateHash, bool approved, uint256 timestamp);
    event StatusChanged(bytes32 indexed willId, Status oldStatus, Status newStatus, address indexed changedBy, uint256 timestamp);

    error WillAlreadyExists();
    error WillNotFound();
    error NotTestator();
    error InvalidStatus();
    error NotWitness();
    error AlreadySigned();
    error InsufficientWitnesses();
    error InvalidTransition();

    modifier onlyExistingWill(bytes32 willId) {
        if (!wills[willId].exists) revert WillNotFound();
        _;
    }

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(AUTHORITY_ROLE, admin);
    }

    // ---------------------------------------------------------------
    // Will creation & finalization
    // ---------------------------------------------------------------

    /// @notice Registers a new draft will. `willId` is generated off-chain
    ///         (matches the backend's Will.id) so the same identifier can be
    ///         used across the database and the chain.
    function createWill(bytes32 willId, bytes32 documentHash) external whenNotPaused {
        if (wills[willId].exists) revert WillAlreadyExists();
        wills[willId] = Will({
            testator: msg.sender,
            documentHash: documentHash,
            status: Status.DRAFT,
            version: 1,
            createdAt: uint40(block.timestamp),
            updatedAt: uint40(block.timestamp),
            witnessCount: 0,
            witnessSignedCount: 0,
            exists: true
        });
        emit WillCreated(willId, msg.sender, documentHash, block.timestamp);
    }

    function updateDocumentHash(bytes32 willId, bytes32 newHash) external onlyExistingWill(willId) {
        Will storage w = wills[willId];
        if (w.testator != msg.sender) revert NotTestator();
        if (w.status != Status.DRAFT) revert InvalidStatus();
        w.documentHash = newHash;
        w.version += 1;
        w.updatedAt = uint40(block.timestamp);
        emit WillDocumentUpdated(willId, newHash, w.version);
    }

    function addWitness(bytes32 willId, address witness) external onlyExistingWill(willId) {
        Will storage w = wills[willId];
        if (w.testator != msg.sender) revert NotTestator();
        if (w.status != Status.DRAFT) revert InvalidStatus();
        if (!isWitnessFor[willId][witness]) {
            isWitnessFor[willId][witness] = true;
            _witnesses[willId].push(witness);
            w.witnessCount += 1;
            emit WitnessAdded(willId, witness);
        }
    }

    function signAsWitness(bytes32 willId) external onlyExistingWill(willId) {
        Will storage w = wills[willId];
        if (!isWitnessFor[willId][msg.sender]) revert NotWitness();
        if (hasSigned[willId][msg.sender]) revert AlreadySigned();
        if (w.status != Status.DRAFT) revert InvalidStatus();
        hasSigned[willId][msg.sender] = true;
        w.witnessSignedCount += 1;
        emit WitnessSigned(willId, msg.sender, block.timestamp);
    }

    function finalizeWill(bytes32 willId) external onlyExistingWill(willId) {
        Will storage w = wills[willId];
        if (w.testator != msg.sender) revert NotTestator();
        if (w.status != Status.DRAFT) revert InvalidStatus();
        if (w.witnessSignedCount < MIN_WITNESSES) revert InsufficientWitnesses();
        _setStatus(willId, Status.ACTIVE);
        emit WillFinalized(willId, block.timestamp);
    }

    function revokeWill(bytes32 willId) external onlyExistingWill(willId) {
        Will storage w = wills[willId];
        if (w.testator != msg.sender) revert NotTestator();
        if (w.status == Status.EXECUTED || w.status == Status.REVOKED) revert InvalidStatus();
        if (w.status == Status.INHERITANCE_IN_PROGRESS) revert InvalidStatus();
        _setStatus(willId, Status.REVOKED);
        emit WillRevoked(willId, msg.sender, block.timestamp);
    }

    // ---------------------------------------------------------------
    // Death verification (ACADEMIC SIMULATION - not a real authority)
    // ---------------------------------------------------------------

    function requestDeathVerification(bytes32 willId) external onlyExistingWill(willId) onlyRole(AUTHORITY_ROLE) {
        Will storage w = wills[willId];
        if (w.status != Status.ACTIVE) revert InvalidStatus();
        _setStatus(willId, Status.DEATH_VERIFICATION_PENDING);
        emit DeathVerificationRequested(willId, msg.sender, block.timestamp);
    }

    function verifyDeath(bytes32 willId, bytes32 certificateHash, bool approved)
        external
        onlyExistingWill(willId)
        onlyRole(AUTHORITY_ROLE)
    {
        Will storage w = wills[willId];
        if (w.status != Status.DEATH_VERIFICATION_PENDING) revert InvalidStatus();
        deathCertificateHash[willId] = certificateHash;
        if (approved) {
            _setStatus(willId, Status.VERIFIED);
        } else {
            _setStatus(willId, Status.ACTIVE);
        }
        emit DeathVerified(willId, msg.sender, certificateHash, approved, block.timestamp);
    }

    // ---------------------------------------------------------------
    // Manager-driven transitions (InheritanceManager / ExecutorManager)
    // ---------------------------------------------------------------

    function setInheritanceInProgress(bytes32 willId) external onlyExistingWill(willId) onlyRole(MANAGER_ROLE) {
        Will storage w = wills[willId];
        if (w.status != Status.VERIFIED) revert InvalidStatus();
        _setStatus(willId, Status.INHERITANCE_IN_PROGRESS);
    }

    function setExecuted(bytes32 willId) external onlyExistingWill(willId) onlyRole(MANAGER_ROLE) {
        Will storage w = wills[willId];
        if (w.status != Status.INHERITANCE_IN_PROGRESS) revert InvalidStatus();
        _setStatus(willId, Status.EXECUTED);
    }

    function setDisputed(bytes32 willId) external onlyExistingWill(willId) onlyRole(MANAGER_ROLE) {
        Will storage w = wills[willId];
        if (w.status == Status.EXECUTED || w.status == Status.REVOKED) revert InvalidStatus();
        _setStatus(willId, Status.DISPUTED);
    }

    function resolveDispute(bytes32 willId, Status restoreTo) external onlyExistingWill(willId) onlyRole(MANAGER_ROLE) {
        Will storage w = wills[willId];
        if (w.status != Status.DISPUTED) revert InvalidStatus();
        if (restoreTo == Status.DISPUTED || restoreTo == Status.EXECUTED) revert InvalidTransition();
        _setStatus(willId, restoreTo);
    }

    function grantManagerRole(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MANAGER_ROLE, manager);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function getWill(bytes32 willId) external view returns (Will memory) {
        return wills[willId];
    }

    function getWitnesses(bytes32 willId) external view returns (address[] memory) {
        return _witnesses[willId];
    }

    function getStatus(bytes32 willId) external view returns (Status) {
        return wills[willId].status;
    }

    function isTestator(bytes32 willId, address account) external view returns (bool) {
        return wills[willId].testator == account;
    }

    function _setStatus(bytes32 willId, Status newStatus) private {
        Will storage w = wills[willId];
        Status old = w.status;
        w.status = newStatus;
        w.updatedAt = uint40(block.timestamp);
        emit StatusChanged(willId, old, newStatus, msg.sender, block.timestamp);
    }
}
