// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {WillRegistry} from "./WillRegistry.sol";
import {ExecutorManager} from "./ExecutorManager.sol";

/// @title InheritanceManager
/// @notice Holds beneficiary allocation tables and inheritance conditions for
///         each will, escrows the demo BWILL token on behalf of the
///         testator, and performs the actual on-chain distribution once a
///         will has been verified and the executor has approved.
/// @dev Uses the checks-effects-interactions pattern and ReentrancyGuard on
///      every state-changing external call that moves tokens. Distribution
///      is idempotent per beneficiary (`claimed` mapping) so a will can
///      never be executed twice for the same beneficiary.
contract InheritanceManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ConditionType {
        IMMEDIATE,
        AGE_BASED,
        TIME_LOCK,
        EXECUTOR_APPROVAL
    }

    struct Beneficiary {
        address wallet;
        uint16 allocationBps; // basis points, 10000 = 100%
        ConditionType condition;
        uint40 conditionParam; // unix timestamp for AGE_BASED / TIME_LOCK, unused otherwise
        bool claimed;
        bool exists;
    }

    WillRegistry public immutable willRegistry;
    ExecutorManager public immutable executorManager;
    IERC20 public immutable bwillToken;

    mapping(bytes32 => address[]) private _beneficiaryList;
    mapping(bytes32 => mapping(address => Beneficiary)) public beneficiaries;
    mapping(bytes32 => uint16) public totalAllocationBps;
    mapping(bytes32 => uint256) public escrowBalance;
    mapping(bytes32 => uint256) public totalDeposited;
    mapping(bytes32 => bool) public disputed;
    mapping(bytes32 => uint256) public distributedCount;

    event BeneficiaryAdded(bytes32 indexed willId, address indexed beneficiary, uint16 allocationBps, ConditionType condition);
    event AssetsDeposited(bytes32 indexed willId, address indexed from, uint256 amount);
    event AssetsWithdrawn(bytes32 indexed willId, address indexed to, uint256 amount);
    event BeneficiaryVerified(bytes32 indexed willId, address indexed beneficiary, address indexed by);
    event InheritanceStarted(bytes32 indexed willId, uint256 timestamp);
    event AssetDistributed(bytes32 indexed willId, address indexed beneficiary, uint256 amount, uint256 timestamp);
    event InheritanceExecuted(bytes32 indexed willId, uint256 timestamp);
    event DisputeRaised(bytes32 indexed willId, address indexed by, string reason, uint256 timestamp);
    event DisputeResolved(bytes32 indexed willId, bool reinstated, uint256 timestamp);

    error NotTestator();
    error InvalidStatus();
    error AllocationExceeded();
    error AllocationIncomplete();
    error NotExecutor();
    error ExecutorNotApproved();
    error NotDisputed();
    error IsDisputed();
    error NotEligible();
    error AlreadyClaimed();
    error NoBeneficiaries();
    error NotBeneficiary();
    error NothingToWithdraw();

    constructor(address admin, address willRegistryAddress, address executorManagerAddress, address bwillTokenAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        willRegistry = WillRegistry(willRegistryAddress);
        executorManager = ExecutorManager(executorManagerAddress);
        bwillToken = IERC20(bwillTokenAddress);
    }

    modifier onlyTestator(bytes32 willId) {
        if (!willRegistry.isTestator(willId, msg.sender)) revert NotTestator();
        _;
    }

    modifier notDisputed(bytes32 willId) {
        if (disputed[willId]) revert IsDisputed();
        _;
    }

    // ---------------------------------------------------------------
    // Beneficiaries & conditions (set while will is DRAFT)
    // ---------------------------------------------------------------

    function addBeneficiary(
        bytes32 willId,
        address beneficiary,
        uint16 allocationBps,
        ConditionType condition,
        uint40 conditionParam
    ) external onlyTestator(willId) {
        WillRegistry.Status status = willRegistry.getStatus(willId);
        if (status != WillRegistry.Status.DRAFT) revert InvalidStatus();

        Beneficiary storage b = beneficiaries[willId][beneficiary];
        uint16 previous = b.exists ? b.allocationBps : 0;
        uint16 newTotal = totalAllocationBps[willId] - previous + allocationBps;
        if (newTotal > 10000) revert AllocationExceeded();

        if (!b.exists) {
            _beneficiaryList[willId].push(beneficiary);
        }
        b.wallet = beneficiary;
        b.allocationBps = allocationBps;
        b.condition = condition;
        b.conditionParam = conditionParam;
        b.exists = true;

        totalAllocationBps[willId] = newTotal;
        emit BeneficiaryAdded(willId, beneficiary, allocationBps, condition);
    }

    function isAllocationComplete(bytes32 willId) public view returns (bool) {
        return totalAllocationBps[willId] == 10000 && _beneficiaryList[willId].length > 0;
    }

    // ---------------------------------------------------------------
    // Escrow (demo BWILL token deposited by testator, released on execution)
    // ---------------------------------------------------------------

    function depositAssets(bytes32 willId, uint256 amount) external onlyTestator(willId) nonReentrant {
        escrowBalance[willId] += amount;
        totalDeposited[willId] += amount;
        emit AssetsDeposited(willId, msg.sender, amount);
        bwillToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawOnRevoke(bytes32 willId) external onlyTestator(willId) nonReentrant {
        if (willRegistry.getStatus(willId) != WillRegistry.Status.REVOKED) revert InvalidStatus();
        uint256 amount = escrowBalance[willId];
        if (amount == 0) revert NothingToWithdraw();
        escrowBalance[willId] = 0;
        emit AssetsWithdrawn(willId, msg.sender, amount);
        bwillToken.safeTransfer(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Inheritance execution
    // ---------------------------------------------------------------

    function startInheritance(bytes32 willId) external notDisputed(willId) {
        if (!executorManager.isExecutorFor(willId, msg.sender)) revert NotExecutor();
        if (!isAllocationComplete(willId)) revert AllocationIncomplete();
        willRegistry.setInheritanceInProgress(willId);
        emit InheritanceStarted(willId, block.timestamp);
    }

    /// @notice Executor marks a beneficiary as identity-verified. Required
    ///         before EXECUTOR_APPROVAL-conditioned funds can be claimed and
    ///         recorded for audit purposes regardless of condition type.
    function verifyBeneficiary(bytes32 willId, address beneficiary) external notDisputed(willId) {
        if (!executorManager.isExecutorFor(willId, msg.sender)) revert NotExecutor();
        if (!beneficiaries[willId][beneficiary].exists) revert NotBeneficiary();
        emit BeneficiaryVerified(willId, beneficiary, msg.sender);
    }

    function isEligible(bytes32 willId, address beneficiary) public view returns (bool) {
        Beneficiary storage b = beneficiaries[willId][beneficiary];
        if (!b.exists || b.claimed) return false;
        if (b.condition == ConditionType.IMMEDIATE) return true;
        if (b.condition == ConditionType.AGE_BASED) return block.timestamp >= b.conditionParam;
        if (b.condition == ConditionType.TIME_LOCK) return block.timestamp >= b.conditionParam;
        if (b.condition == ConditionType.EXECUTOR_APPROVAL) return executorManager.isApproved(willId);
        return false;
    }

    /// @notice Distributes the escrowed BWILL balance to every beneficiary
    ///         who is currently eligible. Beneficiaries whose condition is
    ///         not yet met (e.g. time-locked) remain pending and can later
    ///         call {claim} individually once eligible. Safe to call
    ///         repeatedly - already-claimed beneficiaries are skipped.
    function executeInheritance(bytes32 willId) external nonReentrant notDisputed(willId) {
        if (!executorManager.isExecutorFor(willId, msg.sender)) revert NotExecutor();
        if (!executorManager.isApproved(willId)) revert ExecutorNotApproved();
        WillRegistry.Status status = willRegistry.getStatus(willId);
        if (status != WillRegistry.Status.INHERITANCE_IN_PROGRESS) revert InvalidStatus();

        address[] memory list = _beneficiaryList[willId];
        if (list.length == 0) revert NoBeneficiaries();

        uint256 totalEscrow = totalDeposited[willId];
        bool allClaimed = true;

        for (uint256 i = 0; i < list.length; i++) {
            address addr = list[i];
            Beneficiary storage b = beneficiaries[willId][addr];
            if (b.claimed) continue;
            if (!isEligible(willId, addr)) {
                allClaimed = false;
                continue;
            }
            uint256 amount = (totalEscrow * b.allocationBps) / 10000;
            b.claimed = true;
            escrowBalance[willId] -= amount;
            distributedCount[willId] += 1;
            emit AssetDistributed(willId, addr, amount, block.timestamp);
            if (amount > 0) {
                bwillToken.safeTransfer(addr, amount);
            }
        }

        if (allClaimed) {
            willRegistry.setExecuted(willId);
            emit InheritanceExecuted(willId, block.timestamp);
        }
    }

    /// @notice Pull-based claim for beneficiaries whose condition became
    ///         eligible after the initial {executeInheritance} pass (e.g. a
    ///         time-lock that elapses later).
    function claim(bytes32 willId) external nonReentrant notDisputed(willId) {
        Beneficiary storage b = beneficiaries[willId][msg.sender];
        if (!b.exists) revert NotBeneficiary();
        if (b.claimed) revert AlreadyClaimed();
        if (!isEligible(willId, msg.sender)) revert NotEligible();

        uint256 amount = (totalDeposited[willId] * b.allocationBps) / 10000;
        if (amount > escrowBalance[willId]) {
            amount = escrowBalance[willId];
        }

        b.claimed = true;
        escrowBalance[willId] -= amount;
        distributedCount[willId] += 1;
        emit AssetDistributed(willId, msg.sender, amount, block.timestamp);
        if (amount > 0) {
            bwillToken.safeTransfer(msg.sender, amount);
        }

        if (distributedCount[willId] == _beneficiaryList[willId].length) {
            willRegistry.setExecuted(willId);
            emit InheritanceExecuted(willId, block.timestamp);
        }
    }

    // ---------------------------------------------------------------
    // Disputes
    // ---------------------------------------------------------------

    function raiseDispute(bytes32 willId, string calldata reason) external {
        if (!beneficiaries[willId][msg.sender].exists) revert NotBeneficiary();
        disputed[willId] = true;
        willRegistry.setDisputed(willId);
        emit DisputeRaised(willId, msg.sender, reason, block.timestamp);
    }

    function resolveDispute(bytes32 willId, bool reinstate, WillRegistry.Status restoreTo)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!disputed[willId]) revert NotDisputed();
        disputed[willId] = false;
        if (reinstate) {
            willRegistry.resolveDispute(willId, restoreTo);
        }
        emit DisputeResolved(willId, reinstate, block.timestamp);
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    function getBeneficiaries(bytes32 willId) external view returns (address[] memory) {
        return _beneficiaryList[willId];
    }

    function getBeneficiary(bytes32 willId, address beneficiary) external view returns (Beneficiary memory) {
        return beneficiaries[willId][beneficiary];
    }
}
