# Testing

## Smart contracts — `npm run test:contracts` (from repo root)

Requires nothing running (Hardhat's in-process `hardhat` network is used, not `localhost`). 20 tests across 4 files in `contracts/test/`:

- `WillRegistry.test.ts` — creation, duplicate-ID rejection, witness signature minimums, non-witness/double-signature rejection, revocation authorization + timing, death-verification role + status machine.
- `ExecutorManager.test.ts` — nomination authorization, approval gated on `VERIFIED` status, rejection of a non-nominated approver.
- `InheritanceManager.test.ts` — allocation-exceeds-100%-rejected, non-testator-cannot-add-beneficiary, full lifecycle happy path (finalize → verify → executor-approve → distribute), execution blocked before executor approval, time-lock condition + later `claim()`, dispute pause + resolve + resume, escrow refund on revocation, and an explicit **double-distribution-prevention** assertion (re-calling `executeInheritance` after `EXECUTED` reverts).
- `AccessControl.test.ts` — minter role enforcement, `MANAGER_ROLE`/`AUTHORITY_ROLE` gating on `WillRegistry`, and a check that sending tokens directly to `InheritanceManager` does not silently credit any will's escrow.

Result at time of writing: **20 passing**.

## Backend — `npm run test --workspace backend`

Integration tests (`backend/tests/api.test.ts`) run against the real Express app, a real PostgreSQL database, and the real local Hardhat chain — this project deliberately does not mock the blockchain layer, since verifiable on-chain state is the point. Prerequisites:

1. `npm run blockchain` running in one terminal (the Hardhat node)
2. Contracts deployed: `npm run deploy`
3. `DATABASE_URL` in `backend/.env` pointing at a migrated PostgreSQL database

Covers: registration (incl. weak-password and duplicate-email rejection), login (incl. wrong-password rejection), unauthenticated-access rejection, draft-will creation with on-chain placeholder registration, over-100%-allocation rejection, invalid-wallet-address rejection, finalize-without-witnesses/document/executor rejection, cross-user ownership enforcement, and document hash verification (both the MATCH and DOCUMENT_MODIFIED paths).

Result at time of writing: **11 passing**.

## Frontend

`npm run build --workspace frontend` performs a full TypeScript + Vite production build, which fails on any type error — this is the primary automated check for the frontend in this project (no separate unit-test runner is configured). Manual verification checklist for a UI change: login (incl. demo-account quick-login), dashboard renders for both a regular role and `ADMIN`, will creation wizard end-to-end, wallet connect/disconnect, will finalization, the death-verification flow, and the inheritance dashboard — see `docs/demo-guide.md` for the exact click-path.

## Type-checking

- `npx tsc --noEmit -p backend/tsconfig.json` — backend, strict mode, 0 errors.
- `npx tsc --noEmit -p frontend/tsconfig.json` — frontend, strict mode, 0 errors.

## Running everything from a clean checkout

```bash
npm run setup            # npm install + compile contracts + generate Prisma client
npm run blockchain        # terminal 1 — leave running
npm run deploy             # terminal 2, one-off
npm run db:migrate          # terminal 2, one-off (needs DATABASE_URL)
npm run db:seed              # terminal 2, one-off — demo accounts
npm run test:contracts        # terminal 2
npm run test:backend           # terminal 2 (needs blockchain + DB running)
npm run build                   # terminal 2 — backend + frontend production builds
```
