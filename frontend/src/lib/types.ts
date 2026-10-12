export type UserRole = "TESTATOR" | "BENEFICIARY" | "EXECUTOR" | "WITNESS" | "AUTHORITY" | "ADMIN";

export type WillStatus =
  | "DRAFT"
  | "ACTIVE"
  | "REVOKED"
  | "DEATH_VERIFICATION_PENDING"
  | "VERIFIED"
  | "INHERITANCE_IN_PROGRESS"
  | "EXECUTED"
  | "DISPUTED";

export type ConditionType = "IMMEDIATE" | "AGE_BASED" | "TIME_LOCK" | "EXECUTOR_APPROVAL";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isDemoAccount: boolean;
  createdAt?: string;
}

export interface Beneficiary {
  id: string;
  willId: string;
  name: string;
  walletAddress: string;
  relationship: string;
  allocationBps: number;
  conditionType: ConditionType;
  conditionParam?: string | null;
  distributionStatus: "PENDING" | "ELIGIBLE" | "DISTRIBUTED" | "LOCKED";
  distributedAmount?: string | null;
  verifiedAt?: string | null;
  userId?: string | null;
}

export interface Asset {
  id: string;
  willId: string;
  name: string;
  description?: string | null;
  assetType: string;
  estimatedValue: number;
  transferSimulated: boolean;
}

export interface ExecutorAssignment {
  id: string;
  willId: string;
  userId?: string | null;
  name: string;
  walletAddress: string;
  email: string;
  relationship: string;
  approvedAt?: string | null;
}

export interface Witness {
  id: string;
  willId: string;
  userId?: string | null;
  name: string;
  walletAddress: string;
  status: "PENDING" | "SIGNED" | "DECLINED";
  signedAt?: string | null;
}

export interface DocumentMeta {
  id: string;
  fileName: string;
  sizeBytes: number;
  sha256Hash: string;
  version: number;
  uploadedAt: string;
}

export interface Will {
  id: string;
  onChainId: string;
  title: string;
  status: WillStatus;
  version: number;
  documentHash?: string | null;
  network: string;
  registeredTxHash?: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string | null;
  revokedAt?: string | null;
  testator?: { id: string; fullName: string; email: string };
  beneficiaries: Beneficiary[];
  assets: Asset[];
  executor?: ExecutorAssignment | null;
  witnesses: Witness[];
  conditions?: { id: string; description: string; type: ConditionType }[];
  documents?: DocumentMeta[];
  inheritance?: { startedAt?: string | null; executedAt?: string | null } | null;
  disputes?: Dispute[];
  restricted?: boolean;
  restrictionReason?: string;
}

export interface Dispute {
  id: string;
  willId: string;
  raisedById: string;
  reason: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: string;
  will?: { id: string; title: string; status: WillStatus };
  raisedBy?: { fullName: string; email: string };
}

export interface AuditLogEntry {
  id: string;
  willId?: string | null;
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  details?: Record<string, unknown> | null;
  txHash?: string | null;
  createdAt: string;
  actor?: { fullName: string; role: UserRole; email: string };
}

export interface BlockchainTx {
  id: string;
  willId?: string | null;
  txHash: string;
  eventType: string;
  fromAddress: string;
  toAddress?: string | null;
  contractName: string;
  blockNumber?: number | null;
  gasUsed?: string | null;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  createdAt: string;
  will?: { id: string; title: string } | null;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  willId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  willId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  certificateFileName?: string | null;
  certificateHash?: string | null;
  notes?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  will?: Will;
}
