import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(authenticate, requireRole("WITNESS", "ADMIN"));

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const witnessEntries = await prisma.witness.findMany({
      where: req.user!.role === "ADMIN" ? {} : { userId: req.user!.id },
      include: { will: { include: { testator: { select: { fullName: true, email: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ requests: witnessEntries });
  })
);

export default router;
