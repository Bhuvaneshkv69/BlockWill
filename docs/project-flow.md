# Project Flow

## Overall user workflow

```mermaid
flowchart TD
    A[Register / Login] --> B{Role}
    B -->|Testator| C[Create & finalize a will]
    B -->|Witness| D[Sign witness requests]
    B -->|Executor| E[Approve role, drive inheritance]
    B -->|Authority| F[Simulated death verification]
    B -->|Beneficiary| G[View inheritance, raise disputes]
    B -->|Admin| H[System oversight, dispute resolution]
    C --> I[(Will lifecycle — see below)]
    D --> I
    E --> I
    F --> I
    G --> I
```

## Will creation workflow (8-step wizard)

```mermaid
flowchart LR
    S1[1 Testator Info] --> S2[2 Beneficiaries<br/>must total 100%]
    S2 --> S3[3 Assets]
    S3 --> S4[4 Executor]
    S4 --> S5[5 Witnesses<br/>2+ required]
    S5 --> S6[6 Conditions]
    S6 --> S7[7 Document<br/>hash + encrypt]
    S7 --> S8[8 Review & Finalize]
    S8 -->|witnesses sign independently, then| Finalize[POST /wills/:id/finalize]
```

Each step commits to the database and, for on-chain-relevant data, to the blockchain immediately — there is no separate "save draft" step, because the draft *is* saved (and partially on-chain) from step 1 onward.

## Death verification workflow (ACADEMIC SIMULATION)

```mermaid
sequenceDiagram
    participant Auth as Authority (mock)
    participant API as Backend
    participant WR as WillRegistry.sol

    Auth->>API: POST /verification { willId }
    API->>WR: requestDeathVerification(willId)
    WR-->>API: ACTIVE → DEATH_VERIFICATION_PENDING
    Auth->>API: POST /verification/:id/certificate (mock file)
    API->>API: SHA-256 hash certificate
    Auth->>API: POST /verification/:id/approve
    API->>WR: verifyDeath(willId, certHash, approved=true)
    WR-->>API: DEATH_VERIFICATION_PENDING → VERIFIED
    API-->>Auth: 200 OK
```

## Inheritance execution workflow

```mermaid
flowchart TD
    V[VERIFIED] --> EA[Executor approves role<br/>ExecutorManager.executorApprove]
    EA --> SI[Executor starts inheritance<br/>InheritanceManager.startInheritance]
    SI --> IIP[INHERITANCE_IN_PROGRESS]
    IIP --> VB[Executor verifies each beneficiary<br/>verifyBeneficiary]
    VB --> EX[Executor executes<br/>executeInheritance]
    EX --> Elig{All beneficiaries<br/>currently eligible?}
    Elig -->|Yes| DONE[EXECUTED]
    Elig -->|No — e.g. time-locked| PART[Partial distribution;<br/>remaining beneficiaries call claim() later]
    PART --> Claim[claim() once condition met]
    Claim --> DONE
```

## Blockchain transaction lifecycle

See `docs/blockchain.md` "Transaction lifecycle" for the sequence diagram of how a single API call becomes a signed, mined, and persisted transaction.

## Status reference

`DRAFT → ACTIVE → DEATH_VERIFICATION_PENDING → VERIFIED → INHERITANCE_IN_PROGRESS → EXECUTED`, with `REVOKED` reachable from `DRAFT`/`ACTIVE`, and `DISPUTED` reachable from `ACTIVE`/`INHERITANCE_IN_PROGRESS` (returning to `INHERITANCE_IN_PROGRESS` if resolved). Full state machine in `docs/smart-contracts.md`.
