# Demo Guide

## Fastest path: the Demo Control Panel

1. Start the full stack (see README "Running the project").
2. Log in as **Admin Demo** (`admin@demo.blockwill` / `Demo@1234`) from the login page's demo-account list.
3. Open **Demo Control Panel** in the sidebar.
4. Click each of the 12 steps in order. Each button shows its underlying blockchain transaction(s) in the "Last result" panel and via the toast notification.

| # | Button | What it proves |
|---|---|---|
| 1 | Create Demo Will | Off-chain draft creation + immediate on-chain `WillCreated` registration with beneficiaries/executor/witnesses/assets pre-filled |
| 2 | Generate Document Hash | SHA-256 + AES-256-GCM pipeline, `WillDocumentUpdated` event |
| 3 | Simulate Witness Signatures | Two independent on-chain `WitnessSigned` transactions |
| 4 | Register Will On Blockchain | `WillFinalized` (DRAFT→ACTIVE) + `AssetsDeposited` (5,000 BWILL escrowed) |
| 5 | Simulate Death Certificate | Mock authority opens a `DeathVerificationRequested` request with a hashed certificate — labeled ACADEMIC SIMULATION throughout |
| 6 | Authority Approves Death | `DeathVerified` (ACTIVE→VERIFIED) |
| 7 | Executor Approves | `ExecutorApproved` — only possible because status is VERIFIED |
| 8 | Verify Beneficiaries | `InheritanceStarted` (VERIFIED→INHERITANCE_IN_PROGRESS) + 3× `BeneficiaryVerified` |
| 9 | Execute Smart Contract | `executeInheritance` — on-chain proportional distribution (2,500 / 1,500 / 1,000 BWILL for 50/30/20%) |
| 10 | Distribute Assets | Marks the simulated physical asset (Demo Apartment) transferred; shows final on-chain balances per beneficiary |
| 11 | View Blockchain Audit Trail | The complete, chronological, immutable audit log for this will |
| 12 | Reset Demo | Clears the *database* workspace; on-chain history is untouched — a live demonstration of immutability (see below) |

## 5–10 minute presentation script

1. **(0:30)** Show the login page's demo-account list and the legal disclaimer — explain this is an academic prototype, not a legal service.
2. **(1:30)** Log in as **Testator Demo**, open **Wills → New Will**, walk through 2–3 wizard steps live (add a beneficiary, watch the live allocation pie chart update, upload a document and show the SHA-256 hash appear).
3. **(1:00)** Switch to the **Demo Control Panel** as Admin and run steps 1–4 — point out that "Register Will On Blockchain" is a real transaction by opening **Blockchain Explorer** and clicking "View Transaction" on the `WillFinalized` entry.
4. **(1:30)** Run steps 5–8, narrating: *"This is where a real deployment would need a legally recognized death registry — here it's explicitly simulated."* Show the **Verification Page**'s ACADEMIC SIMULATION badge.
5. **(1:30)** Run step 9 and immediately open the will's **Inheritance** tab to show the three beneficiaries' `DISTRIBUTED` status and BWILL amounts, then switch to **Documents → Verify Document**, upload the same file, and show `MATCH` — then upload a modified copy and show `DOCUMENT_MODIFIED`.
6. **(1:00)** Open **DLT Network** and explain the node visualization; open **Blockchain Explorer** and show block number/contract addresses.
7. **(1:00)** Run step 11 (audit trail) and scroll through the full chronological history; mention that every entry has a transaction hash.
8. **(0:30)** Close on **Disputes** — briefly show that raising a dispute (as a beneficiary) would pause distribution, and that only an admin can resolve it.

## Manual (non-panel) walkthrough

Everything the control panel automates can also be done by hand, logged in as each real role in turn (`Testator Demo`, `Witness Demo (1)`/`(2)`, `Executor Demo`, `Authority Demo`), which is useful for demonstrating the actual multi-user, multi-login workflow rather than the single-click version. The **Wills → Create Will** wizard, **Witness Requests**, **Executor Console**, and **Simulated Authority Portal** pages cover the same ground as steps 1–9 above.

## Resetting between demo runs

Step 12 clears BlockWill's *database* record of the demo will so you can start clean. It intentionally does **not** attempt to erase blockchain history — that's the point: ask your evaluator "what happens if I try to delete a blockchain record?" and show them that the old transactions are still visible in the Blockchain Explorer even after a reset. That's immutability, demonstrated rather than just claimed.
