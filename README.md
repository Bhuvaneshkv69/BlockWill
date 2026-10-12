
# BlockWill — Blockchain-Based Digital Will & Inheritance Management System

> **Academic prototype.** This platform demonstrates blockchain-based digital will and inheritance management for a final-year Computer Science / Blockchain Technology project. It does not constitute legal advice, does not create a legally valid will by itself, and does not replace execution requirements under applicable law. Death verification is **simulated** and is not a real government integration. See [Legal Disclaimer](#legal-disclaimer).

## 1. Project Overview

BlockWill lets a testator create a digital will through a guided wizard, name beneficiaries with percentage allocations and inheritance conditions, nominate an executor, add witnesses, and upload a legal document. The document is SHA-256 hashed and AES-256-GCM encrypted; only the hash is recorded on a local Hardhat blockchain. Once finalized, the will's lifecycle — death verification (simulated), executor approval, beneficiary eligibility, and smart-contract-driven asset distribution — is executed and permanently auditable on-chain.

## 2. Problem Statement

Traditional wills rely entirely on paper, notaries, and institutional trust: documents can be lost, forged, or contested with no independent way to verify what was originally signed, and executing an inheritance can take months of manual, opaque coordination between family members, lawyers, and courts. BlockWill demonstrates how cryptographic hashing, smart contracts, and an immutable audit trail can make the *integrity* of a will and the *execution* of its instructions independently verifiable — without exposing the private, sensitive content of the will itself.

## 3. Objectives

- Demonstrate practical integration of blockchain, smart contracts, and cryptography in a legally-adjacent domain.
- Separate on-chain integrity data from off-chain sensitive content, and document why.
- Automate inheritance execution via smart contracts with real safeguards (double-distribution prevention, dispute pausing, access control).
- Provide role-based access control across six distinct participant types.
- Produce a complete, immutable, human-readable audit trail for every critical action.
- Do all of the above without any paid API, real cryptocurrency, or real government integration.

## 4. Features

Multi-role auth (Testator, Beneficiary, Executor, Witness, Authority, Admin) · 8-step will creation wizard with live allocation chart · document SHA-256 hashing + AES-256-GCM encryption · on-chain will registration, witness signing, and finalization · simulated death-verification authority portal · executor approval + beneficiary eligibility workflow · smart-contract BWILL token distribution (immediate/age-based/time-locked/executor-approval conditions) · dispute system that pauses distribution on-chain · immutable audit trail with linked transaction hashes · internal blockchain explorer · DLT network visualization · document hash re-verification (MATCH/MODIFIED) · will versioning · in-app notifications + email simulator · admin dashboard · one-click Demo Control Panel with 12 discrete, independently-runnable steps.

## 5–11. Architecture, Technology Stack, Blockchain/DLT/Smart-Contract/Database/Security Architecture

See [`docs/architecture.md`](docs/architecture.md), [`docs/blockchain.md`](docs/blockchain.md), [`docs/dlt.md`](docs/dlt.md), [`docs/smart-contracts.md`](docs/smart-contracts.md), [`docs/database.md`](docs/database.md), and [`docs/security.md`](docs/security.md) for full detail, including Mermaid diagrams. Summary technology stack:

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, Recharts, React Router, ethers.js v6
- **Backend:** Node.js, TypeScript, Express, Prisma ORM, Zod validation, JWT auth, bcrypt
- **Blockchain:** Solidity `^0.8.24`, Hardhat, OpenZeppelin Contracts 5.x, ethers.js v6, local Hardhat network
- **Database:** PostgreSQL
- **Infra:** Docker Compose (PostgreSQL + optionally backend/frontend containers)

## 12. Installation

Prerequisites: **Node.js 20+**, **npm 10+**, **Docker** (for PostgreSQL, or run Postgres yourself), **git**.

```bash
git clone <this-repo>
cd blockwill
npm run setup     # installs all 3 workspaces, compiles contracts, generates Prisma client
```

## 13. Environment Setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Generate a real encryption key for `backend/.env`'s `ENCRYPTION_KEY` (32 bytes, hex-encoded):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Start PostgreSQL (Docker):

```bash
docker compose up -d postgres
```

Or point `DATABASE_URL` in `backend/.env` at your own PostgreSQL instance.

## 14. Running the Blockchain

```bash
npm run blockchain   # starts a local Hardhat node on http://127.0.0.1:8545 (leave running)
```

## 15. Deploying Contracts

In a second terminal:

```bash
npm run deploy        # deploys BWillToken, WillRegistry, ExecutorManager, InheritanceManager
                        # writes addresses + ABIs to shared/abi/
```

## 16. Running the Backend

```bash
npm run db:migrate --workspace backend    # first time only — creates tables
npm run db:seed --workspace backend        # seeds 9 demo accounts + wallets
(cd contracts && npm run seed:local)         # funds the demo testator with 10,000 BWILL
npm run dev:backend                            # http://localhost:4000
```

## 17. Running the Frontend

```bash
npm run dev:frontend   # http://localhost:5173
```

### 17.1 Browser wallet setup (optional — Firefox / legacy MetaMask)

The app's core workflow uses a custodial signer model (see §23 Limitations), so a browser wallet is **not required** to run the full demo. It's only needed on the **Settings** page to link a wallet address or sign transactions client-side. That flow is compatible with both the modern `window.ethereum` injection and pre-EIP-1193 "legacy web3" MetaMask builds (the `window.web3.currentProvider` API, as shipped in early MetaMask releases by danfinlay/rekmarks) — `frontend/src/lib/injectedProvider.ts` detects and adapts whichever one is present.

To use it in Firefox:

1. Install the MetaMask extension from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/) (or side-load a legacy `.xpi` build via `about:debugging` → "This Firefox" → "Load Temporary Add-on").
2. Open `http://localhost:5173` in Firefox and create/unlock a wallet.
3. Add the local network manually: Network name `Hardhat Local`, RPC URL `http://127.0.0.1:8545`, Chain ID `31337`, Currency symbol `ETH` (the Settings page's "Switch to Hardhat Local" button does this automatically for wallets that support `wallet_addEthereumChain`; older legacy-web3 builds may not, hence the manual steps).
4. Import a demo account's private key printed by `npm run blockchain` (e.g. Account #1 for Testator Demo) if you want to sign as that wallet.
5. Go to **Settings → Wallet connection → Connect**.

## 18. Running Tests

```bash
npm run test:contracts   # 20 Hardhat/Solidity tests
npm run test:backend      # 11 integration tests (needs blockchain + deployed contracts + migrated DB)
npm run build:frontend      # TypeScript + Vite production build (fails on any type error)
```

See [`docs/testing.md`](docs/testing.md) for full detail and prerequisites.

## 19. Demo Workflow

Log in as **Admin Demo** and open **Demo Control Panel** for a 12-button, fully-narrated walkthrough of the entire lifecycle. See [`docs/demo-guide.md`](docs/demo-guide.md) for a full 5–10 minute presentation script and the manual (non-panel) walkthrough.

Demo accounts (password for all: `Demo@1234`):

| Email | Role |
|---|---|
| `admin@demo.blockwill` | Admin |
| `alex.morgan@demo.blockwill` | Testator |
| `james.morgan@demo.blockwill` | Executor |
| `witness.one@demo.blockwill` / `witness.two@demo.blockwill` | Witness |
| `authority@demo.blockwill` | Authority (mock) |
| `sarah.morgan@demo.blockwill` / `daniel.morgan@demo.blockwill` / `emma.morgan@demo.blockwill` | Beneficiary (50% / 30% / 20%) |

## 20. Screenshots

_Add screenshots here after your first local run:_ `docs/screenshots/dashboard.png`, `will-wizard.png`, `demo-control-panel.png`, `blockchain-explorer.png`, `dlt-network.png`.

## 21. API Documentation

See [`docs/api.md`](docs/api.md) for the full endpoint reference.

## 22. Smart Contract Documentation

See [`docs/smart-contracts.md`](docs/smart-contracts.md) for contract responsibilities, the status state machine, and the security patterns used.

## 23. Limitations

- **Custodial signer model.** The backend signs on behalf of every user with a server-derived wallet rather than requiring a browser wallet for every action — a deliberate simplification for demoability, documented in full (including the production alternative) in [`docs/security.md`](docs/security.md).
- **Single local Hardhat node.** The DLT visualization is conceptual, not a real multi-node network — see [`docs/dlt.md`](docs/dlt.md).
- **Simulated death verification.** No real government or civil-registry integration exists or is planned for this prototype.
- **No legal validity.** Nothing in this system constitutes a legally executed will in any jurisdiction.
- **No rate limiting** on auth/upload endpoints; not production-hardened against abuse.
- **Single-currency demo asset.** Only the BWILL ERC-20 token is actually distributed on-chain; other asset types use a simulated transfer workflow.
- **Frontend bundle is not code-split** (single ~950 kB JS chunk) — fine for a local demo, worth addressing before any real deployment.

## 24. Future Enhancements

- Client-side (MetaMask) signing for testator-initiated actions, using the custodial model only as a fallback.
- Real multi-node permissioned network (e.g. Hyperledger Besu or a small validator set) to make the DLT demonstration physically real, not just conceptual.
- IPFS/Filecoin for encrypted document storage instead of local disk.
- Multi-signature executor approval for high-value estates.
- Real notary/e-signature API integration for jurisdictions that recognize it.
- zk-proof-based beneficiary identity verification without revealing personal data on-chain.

## 25. Legal Disclaimer

**This platform is an academic prototype for demonstrating blockchain-based digital will and inheritance management. It does not constitute legal advice, does not create a legally valid will by itself, and does not replace execution requirements under applicable law.** Death verification, the "Simulated Authority Portal," and all related workflows are explicitly labeled **ACADEMIC SIMULATION — NOT A REAL GOVERNMENT INTEGRATION** throughout the UI. No real sensitive personal information should be entered into this system.

---

### Full documentation index

[`docs/architecture.md`](docs/architecture.md) · [`docs/blockchain.md`](docs/blockchain.md) · [`docs/smart-contracts.md`](docs/smart-contracts.md) · [`docs/dlt.md`](docs/dlt.md) · [`docs/database.md`](docs/database.md) · [`docs/api.md`](docs/api.md) · [`docs/security.md`](docs/security.md) · [`docs/testing.md`](docs/testing.md) · [`docs/demo-guide.md`](docs/demo-guide.md) · [`docs/project-flow.md`](docs/project-flow.md)
