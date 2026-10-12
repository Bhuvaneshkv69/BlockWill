import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../lib/demoAccounts";
import { getContract } from "../blockchain/contracts";
import { ensureFunded } from "../blockchain/faucet";
import { getAdminSigner } from "../blockchain/signers";
import { signerFor } from "../services/willService";
import { logAudit } from "../services/auditService";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2),
  role: z.nativeEnum(UserRole),
  dateOfBirth: z.string().datetime().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function issueToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

function sanitize(user: { id: string; email: string; fullName: string; role: UserRole; isDemoAccount: boolean; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isDemoAccount: user.isDemoAccount,
    createdAt: user.createdAt,
  };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      },
    });

    // Custodial demo-signer model (see blockchain/signers.ts): every user gets a
    // deterministic wallet the backend can sign with on their behalf.
    const signer = signerFor(user);
    const walletAddress = await signer.getAddress();
    await prisma.wallet.create({ data: { userId: user.id, address: walletAddress, label: "Primary", isPrimary: true } });

    try {
      await ensureFunded(walletAddress);
    } catch (err) {
      console.warn("Could not fund new user's demo wallet (is the local blockchain running?)", err);
    }

    if (input.role === "AUTHORITY") {
      try {
        const registry = getContract("WillRegistry", getAdminSigner());
        const AUTHORITY_ROLE = await registry.AUTHORITY_ROLE();
        const tx = await registry.grantRole(AUTHORITY_ROLE, walletAddress);
        await tx.wait();
      } catch (err) {
        // Chain may not be running yet in some dev flows; account creation should not hard-fail.
        console.warn("Could not grant on-chain AUTHORITY_ROLE (is the local blockchain running?)", err);
      }
    }

    await logAudit({ actorId: user.id, actorRole: user.role, action: "USER_REGISTERED" });

    const token = issueToken(user.id);
    res.status(201).json({ token, user: sanitize(user), wallet: walletAddress });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw AppError.unauthorized("Invalid email or password");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw AppError.unauthorized("Invalid email or password");

    const token = issueToken(user.id);
    await logAudit({ actorId: user.id, actorRole: user.role, action: "USER_LOGIN", req });
    res.json({ token, user: sanitize(user) });
  })
);

router.get(
  "/demo-accounts",
  asyncHandler(async (_req, res) => {
    res.json({
      password: DEMO_PASSWORD,
      accounts: DEMO_ACCOUNTS.map((a) => ({ email: a.email, role: a.role, label: a.demoLabel })),
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { wallets: true } });
    res.json({ user: sanitize(user), wallets: user.wallets.map((w) => ({ address: w.address, label: w.label })) });
  })
);

export default router;
