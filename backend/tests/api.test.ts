import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

/**
 * Integration tests against the real Express app, a real PostgreSQL
 * database, and the real local Hardhat chain (same as the contract test
 * suite's philosophy — this project intentionally avoids mocking the
 * blockchain layer since the whole point is verifiable on-chain state).
 *
 * Prerequisites (see docs/testing.md):
 *   1. `npm run blockchain` running in one terminal
 *   2. Contracts deployed: `npm run deploy`
 *   3. DATABASE_URL pointing at a migrated PostgreSQL instance
 */

const app = createApp();

function randomEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.blockwill`;
}

describe("Auth", () => {
  it("registers a new testator and returns a JWT", async () => {
    const email = randomEmail("testator");
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "SuperSecret123",
      fullName: "Test Testator",
      role: "TESTATOR",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.wallet).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("rejects registration with a weak password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: randomEmail("weak"),
      password: "short",
      fullName: "Weak Password",
      role: "TESTATOR",
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email registration", async () => {
    const email = randomEmail("dup");
    const payload = { email, password: "SuperSecret123", fullName: "Dup User", role: "TESTATOR" };
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.status).toBe(409);
  });

  it("rejects login with wrong password", async () => {
    const email = randomEmail("wrongpw");
    await request(app)
      .post("/api/auth/register")
      .send({ email, password: "SuperSecret123", fullName: "Wrong PW", role: "TESTATOR" });
    const res = await request(app).post("/api/auth/login").send({ email, password: "totallyWrong1" });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const res = await request(app).get("/api/wills");
    expect(res.status).toBe(401);
  });
});

describe("Will creation & validation", () => {
  let token: string;

  beforeAll(async () => {
    const email = randomEmail("will-flow");
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "SuperSecret123",
      fullName: "Will Flow Testator",
      role: "TESTATOR",
    });
    token = res.body.token;
  });

  it("creates a draft will and registers a placeholder hash on-chain", async () => {
    const res = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Integration Test Will" });
    expect(res.status).toBe(201);
    expect(res.body.will.status).toBe("DRAFT");
    expect(res.body.will.onChainId).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(res.body.will.registeredTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  }, 20000);

  it("rejects beneficiary allocation that exceeds 100%", async () => {
    const createRes = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Over-allocated Will" });
    const willId = createRes.body.will.id;

    await request(app)
      .post(`/api/wills/${willId}/beneficiaries`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Beneficiary A",
        walletAddress: "0x00000000000000000000000000000000000000a1",
        relationship: "Friend",
        allocationPercent: 70,
      })
      .expect(201);

    const res = await request(app)
      .post(`/api/wills/${willId}/beneficiaries`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Beneficiary B",
        walletAddress: "0x00000000000000000000000000000000000000a2",
        relationship: "Friend",
        allocationPercent: 40,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/100%/);
  }, 30000);

  it("rejects an invalid wallet address", async () => {
    const createRes = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bad Wallet Will" });
    const willId = createRes.body.will.id;

    const res = await request(app)
      .post(`/api/wills/${willId}/beneficiaries`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Wallet", walletAddress: "not-an-address", relationship: "Friend", allocationPercent: 50 });

    expect(res.status).toBe(400);
  }, 20000);

  it("refuses to finalize a will with no witnesses, document, or executor", async () => {
    const createRes = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Incomplete Will" });
    const willId = createRes.body.will.id;

    const res = await request(app).post(`/api/wills/${willId}/finalize`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  }, 20000);

  it("blocks another user from editing someone else's will", async () => {
    const createRes = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ownership Test Will" });
    const willId = createRes.body.will.id;

    const otherRes = await request(app).post("/api/auth/register").send({
      email: randomEmail("intruder"),
      password: "SuperSecret123",
      fullName: "Intruder",
      role: "TESTATOR",
    });
    const otherToken = otherRes.body.token;

    const res = await request(app)
      .put(`/api/wills/${willId}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ title: "Hijacked title" });

    expect(res.status).toBe(403);
  }, 20000);
});

describe("Document hash verification", () => {
  it("reports MATCH for an untouched document and MODIFIED for a tampered one", async () => {
    const email = randomEmail("doc-verify");
    const auth = await request(app)
      .post("/api/auth/register")
      .send({ email, password: "SuperSecret123", fullName: "Doc Verifier", role: "TESTATOR" });
    const token = auth.body.token;

    const createRes = await request(app)
      .post("/api/wills")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Doc Verify Will" });
    const willId = createRes.body.will.id;

    const original = Buffer.from("This is the original will content.");
    const upload = await request(app)
      .post(`/api/wills/${willId}/documents`)
      .set("Authorization", `Bearer ${token}`)
      .attach("document", original, { filename: "will.txt", contentType: "text/plain" });
    expect(upload.status).toBe(201);

    const matchRes = await request(app)
      .post(`/api/documents/verify`)
      .field("willId", willId)
      .attach("document", original, { filename: "will.txt", contentType: "text/plain" })
      .set("Authorization", `Bearer ${token}`);
    expect(matchRes.body.result).toBe("MATCH");

    const tampered = Buffer.from("This is TAMPERED will content.");
    const modifiedRes = await request(app)
      .post(`/api/documents/verify`)
      .field("willId", willId)
      .attach("document", tampered, { filename: "will.txt", contentType: "text/plain" })
      .set("Authorization", `Bearer ${token}`);
    expect(modifiedRes.body.result).toBe("DOCUMENT_MODIFIED");
  }, 30000);
});

afterAll(async () => {
  await prisma.$disconnect();
});
