// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {WillRegistry} from "./WillRegistry.sol";

/// @title ExecutorManager
/// @notice Tracks who is nominated as executor for each will and records the
///         executor's on-chain approval before InheritanceManager is allowed
///         to distribute assets. Keeping this as its own contract mirrors
///         the real-world separation between "who wrote the will" and
///         "who is trusted to carry it out".
contract ExecutorManager is AccessControl {
    WillRegistry public immutable willRegistry;

    struct ExecutorInfo {
        address executor;
        bool approved;
        uint40 nominatedAt;
        uint40 approvedAt;
    }

    mapping(bytes32 => ExecutorInfo) public executors;

    event ExecutorNominated(bytes32 indexed willId, address indexed executor, uint256 timestamp);
    event ExecutorApproved(bytes32 indexed willId, address indexed executor, uint256 timestamp);

    error NotTestator();
    error NotExecutor();
    error AlreadyApproved();
    error InvalidWillStatus();

    constructor(address admin, address willRegistryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        willRegistry = WillRegistry(willRegistryAddress);
    }

    /// @notice Testator nominates an executor for their will (any time before execution).
    function nominateExecutor(bytes32 willId, address executor) external {
        if (!willRegistry.isTestator(willId, msg.sender)) revert NotTestator();
        executors[willId] = ExecutorInfo({
            executor: executor,
            approved: false,
            nominatedAt: uint40(block.timestamp),
            approvedAt: 0
        });
        emit ExecutorNominated(willId, executor, block.timestamp);
    }

    /// @notice The nominated executor formally accepts the role once the will
    ///         has been VERIFIED (death confirmed), signalling readiness to
    ///         carry out distribution. This is the "Executor Approves" step
    ///         shown in the demo control panel.
    function executorApprove(bytes32 willId) external {
        ExecutorInfo storage info = executors[willId];
        if (info.executor != msg.sender) revert NotExecutor();
        if (info.approved) revert AlreadyApproved();
        WillRegistry.Status status = willRegistry.getStatus(willId);
        if (status != WillRegistry.Status.VERIFIED) revert InvalidWillStatus();
        info.approved = true;
        info.approvedAt = uint40(block.timestamp);
        emit ExecutorApproved(willId, msg.sender, block.timestamp);
    }

    function isExecutorFor(bytes32 willId, address account) external view returns (bool) {
        return executors[willId].executor == account;
    }

    function isApproved(bytes32 willId) external view returns (bool) {
        return executors[willId].approved;
    }

    function getExecutor(bytes32 willId) external view returns (ExecutorInfo memory) {
        return executors[willId];
    }
}
