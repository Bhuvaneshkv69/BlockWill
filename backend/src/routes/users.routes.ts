import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const router = Router();
router.use(authenticate);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { wallets: true } });
    res.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isDemoAccount: user.isDemoAccount },
      wallets: user.wallets,
    });
  })
);

/** Registers a MetaMask (or other injected wallet) address for display/verification purposes. */
router.post(
  "/wallet",
  asyncHandler(async (req, res) => {
    const schema = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/), label: z.string().optional() });
    const input = schema.parse(req.body);

    const existing = await prisma.wallet.findUnique({ where: { address: input.address } });
    if (existing && existing.userId !== req.user!.id) {
      throw AppError.conflict("This wallet address is already linked to another account");
    }

    const wallet = await prisma.wallet.upsert({
      where: { address: input.address },
      update: { label: input.label ?? "Connected Wallet" },
      create: { userId: req.user!.id, address: input.address, label: input.label ?? "Connected Wallet", isPrimary: false },
    });

    res.status(201).json({ wallet });
  })
);

export default router;
