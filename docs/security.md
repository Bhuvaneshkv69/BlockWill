# Security Model

## Cryptography

| Purpose | Algorithm | Where |
|---|---|---|
| Document integrity | SHA-256 | `backend/src/crypto/hash.ts` |
| Document confidentiality at rest | AES-256-GCM (random 96-bit IV per file, auth tag verified on decrypt) | `backend/src/crypto/encryption.ts` |
| Password storage | bcrypt (cost 10) | `backend/src/routes/auth.routes.ts` |
| Transaction signing | ECDSA (secp256k1), via Ethereum wallets | `backend/src/blockchain/signers.ts` |
| Session auth | JWT (HS256, `JWT_SECRET`, configurable expiry) | `backend/src/middleware/auth.ts` |

**Why hash the document?** A 32-byte hash is cheap to store on-chain and lets anyone re-derive it from a copy of the document to prove — cryptographically, not by trusting BlockWill — that the file hasn't changed since registration. Storing the multi-megabyte document itself on-chain would be prohibitively expensive and would make it permanently public.

**Why encrypt the document?** The hash proves integrity but reveals nothing about content; the document itself still needs confidentiality at rest, since it contains names, relationships, and financial details. AES-256-GCM was chosen over CBC for its built-in authentication (tamper detection on decrypt, not just confidentiality).

## Custodial signer model — the honest trade-off

BlockWill's backend derives and holds the private keys used to sign every on-chain transaction (see `docs/blockchain.md`). This is **appropriate for a local academic demo** and **not how a production system should be built**. Specifically:

- Private keys are never hardcoded. They are derived at runtime from `HARDHAT_DEMO_MNEMONIC`, which defaults to Hardhat's own publicly documented local test mnemonic — not a secret, and only ever valid against the ephemeral local chain.
- Private keys never reach the frontend, never appear in a request/response body, and are never logged.
- A real deployment would replace this with client-side signing (MetaMask/WalletConnect for individual users) or a proper custody provider (e.g. an HSM-backed signer service) for any account the backend must act on behalf of. The `WalletContext` MetaMask integration already present in the frontend (`Settings` page — connect, view balance, network) is the intended seam for that change; the API layer would only need each write route to accept a pre-signed transaction instead of building one from a stored key.

## What the admin cannot do

The `ADMIN` role has full read access to system state (`/admin/*` routes) and can resolve disputes, but:

- Cannot edit `Will.status` directly in a way that bypasses the smart contract — every status change the API can trigger (finalize, revoke, verify, dispute, execute) goes through a contract call first; the database is only updated after that call succeeds, using the value the contract actually returned.
- Cannot rewrite a document hash, a witness signature, or a blockchain transaction record — none of those tables have an admin-facing update endpoint.
- Cannot "undo" an executed distribution — `InheritanceManager` tracks `claimed` per beneficiary on-chain and refuses to pay twice, and there is no admin function anywhere in the contracts that can reset it.

## Role-based access control

Enforced at two layers:

1. **API layer** — `requireRole(...)` middleware on every route that should be role-restricted, plus per-action ownership checks in the service layer (e.g. "only the testator who created this will" or "only the nominated executor").
2. **Contract layer** — OpenZeppelin `AccessControl` roles (`AUTHORITY_ROLE`, `MANAGER_ROLE`) and explicit `msg.sender` checks (e.g. `isTestator`, `isExecutorFor`) gate every state-changing function, independent of whatever the API layer does. Even if the API layer had a bug, the contract itself would still reject an unauthorized transaction.

## Input validation

Every request body is validated with Zod schemas before touching the database or the chain (wallet-address regex/checksum normalization, allocation bounds, enum membership, required fields). See `docs/api.md` and the validation list in the main README for the full set of business rules enforced (100% allocation, minimum witnesses, no double execution, etc.).

## What is never exposed

- Stack traces (see `errorHandler.ts` — only a generic message reaches the client in production; `NODE_ENV=development` shows a debug string locally).
- Raw uploaded documents outside of the encrypted-at-rest store; only the testator (or admin) can request a decrypted download, over an authenticated route.
- Private keys, at any layer, ever.

## Known limitations (see also README "Limitations")

- The custodial signer model is a demo simplification, not production key custody.
- JWT has no refresh-token rotation or revocation list; a leaked token is valid until expiry.
- Rate limiting is not implemented; a production deployment should add it in front of `auth` and file-upload routes.
- File upload validation is MIME-type based, not deep content inspection.
