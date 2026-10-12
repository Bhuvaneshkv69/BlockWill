# API Reference

Base URL: `http://localhost:4000/api`. All endpoints except `/auth/register`, `/auth/login`, and `/auth/demo-accounts` require `Authorization: Bearer <jwt>`.

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create an account (provisions a custodial wallet; funds it via faucet) |
| POST | `/auth/login` | Email/password login, returns JWT |
| GET | `/auth/demo-accounts` | List demo account emails + shared demo password |
| GET | `/auth/me` | Current user + linked wallets |

## Users

| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Current user profile |
| POST | `/users/wallet` | Link a MetaMask address for display/verification |

## Wills

| Method | Path | Description |
|---|---|---|
| GET | `/wills` | List wills visible to the current role |
| POST | `/wills` | Create a draft will (registers a placeholder hash on-chain) |
| GET | `/wills/:id` | Full will detail (beneficiary-visibility-gated before verification) |
| PUT | `/wills/:id` | Edit title (DRAFT only) |
| POST | `/wills/:id/beneficiaries` | Add a beneficiary (validates ≤100% allocation, on-chain `addBeneficiary`) |
| DELETE | `/wills/:id/beneficiaries/:beneficiaryId` | Remove a beneficiary (DRAFT only) |
| POST | `/wills/:id/assets` | Add an asset (off-chain metadata) |
| POST | `/wills/:id/executor` | Nominate an executor (on-chain `nominateExecutor`) |
| POST | `/wills/:id/executor/approve` | Executor approves their role (requires `VERIFIED` status) |
| POST | `/wills/:id/witnesses` | Add a witness (on-chain `addWitness`) |
| POST | `/wills/:id/witnesses/:witnessId/sign` | Witness signs (on-chain `signAsWitness`) |
| POST | `/wills/:id/conditions` | Add a descriptive inheritance-condition note |
| POST | `/wills/:id/documents` | Upload a document — SHA-256 hash, AES-256-GCM encrypt, on-chain `updateDocumentHash` |
| POST | `/wills/:id/deposit` | Deposit BWILL into escrow (on-chain `approve` + `depositAssets`) |
| POST | `/wills/:id/finalize` | Finalize (requires 100% allocation, document, 2+ signed witnesses, executor) |
| POST | `/wills/:id/revoke` | Revoke (testator only, before execution) |
| GET | `/wills/:id/audit` | Audit trail for this will |
| POST | `/wills/:id/verify-document` | Compare an uploaded file's hash against the will's on-chain hash |

## Beneficiaries / Executor / Witness

| Method | Path | Description |
|---|---|---|
| GET | `/beneficiaries` | Wills where the current user is a named beneficiary, with live on-chain balance |
| GET | `/executor/wills` | Wills where the current user is the nominated executor |
| GET | `/witness/requests` | Witness requests assigned to the current user |

## Verification (mock authority — ACADEMIC SIMULATION)

| Method | Path | Description |
|---|---|---|
| GET | `/verification/pending` | Pending requests |
| GET | `/verification` | All requests |
| POST | `/verification` | Open a request for an ACTIVE will (on-chain `requestDeathVerification`) |
| POST | `/verification/:id/certificate` | Upload + hash a mock death certificate |
| POST | `/verification/:id/approve` | Approve (on-chain `verifyDeath(approved=true)`) |
| POST | `/verification/:id/reject` | Reject (on-chain `verifyDeath(approved=false)`) |

## Inheritance

| Method | Path | Description |
|---|---|---|
| GET | `/inheritance/:willId` | Inheritance process status + distributions |
| POST | `/inheritance/:willId/start` | Executor starts distribution (on-chain `startInheritance`) |
| POST | `/inheritance/:willId/verify-beneficiary/:beneficiaryId` | Executor verifies a beneficiary |
| POST | `/inheritance/:willId/execute` | Execute distribution (on-chain `executeInheritance`) |

## Disputes

| Method | Path | Description |
|---|---|---|
| GET | `/disputes` | List disputes (own, or all for admin/executor) |
| POST | `/disputes` | Raise a dispute (beneficiary only; on-chain `raiseDispute`, pauses distribution) |
| POST | `/disputes/:id/resolve` | Admin resolves/rejects (on-chain `resolveDispute`) |

## Documents

| Method | Path | Description |
|---|---|---|
| GET | `/documents` | List documents (own wills, or all for admin) |
| GET | `/documents/:id/download` | Download + decrypt the original file (testator/admin only) |
| POST | `/documents/verify` | Hash-verify an uploaded file against a will's on-chain hash |

## Blockchain

| Method | Path | Description |
|---|---|---|
| GET | `/blockchain/status` | Chain reachability, current block, deployed contract addresses |
| GET | `/blockchain/events` | Paginated `BlockchainTransaction` list, filterable by will/tx hash/address/event type |
| GET | `/blockchain/tx/:hash` | Single transaction detail (DB record + live chain receipt) |
| GET | `/blockchain/search` | Search by tx hash / wallet address / will ID |
| GET | `/blockchain/dlt-network` | DLT visualization data |

## Audit / Notifications

| Method | Path | Description |
|---|---|---|
| GET | `/audit/:willId` | Audit trail |
| GET | `/notifications` | Current user's notifications |
| PATCH | `/notifications/:id/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |
| GET | `/notifications/emails` | Email simulator log |

## Admin

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Dashboard aggregate counts + charts |
| GET | `/admin/users` | All users |
| GET | `/admin/contracts` | Deployment status |
| GET | `/admin/audit-logs` | Global audit log |

## Demo

| Method | Path | Description |
|---|---|---|
| GET | `/demo/status` | Current demo will, if any |
| POST | `/demo/step/:n` | Run demo control-panel step `1`–`12` (see `docs/demo-guide.md`) |

## Error format

```json
{ "error": { "code": "BAD_REQUEST", "message": "Human-readable explanation", "details": [...] } }
```

Stack traces are never sent to the client (see `src/middleware/errorHandler.ts`); Zod validation failures return `400` with per-field `details`, Prisma unique/not-found errors are mapped to `409`/`404`.
