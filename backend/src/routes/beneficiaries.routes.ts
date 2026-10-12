import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { tokenBalanceOf } from "../blockchain/willChain";
import { fromTokenAmount } from "../blockchain/utils";

const router = Router();
router.use(authenticate, requireRole("BENEFICIARY", "ADMIN"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const entries = await prisma.beneficiary.findMany({
      where: req.user!.role === "ADMIN" ? {} : { userId: req.user!.id },
      include: { will: { select: { id: true, title: true, status: true, testator: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    const withBalances = await Promise.all(
      entries.map(async (e) => ({
        ...e,
        allocationPercent: e.allocationBps / 100,
        onChainBalance: fromTokenAmount(await tokenBalanceOf(e.walletAddress)).toString(),
      }))
    );

    res.json({ beneficiaries: withBalances });
  })
);

export default router;
