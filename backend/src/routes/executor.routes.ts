import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(authenticate, requireRole("EXECUTOR", "ADMIN"));

router.get(
  "/wills",
  asyncHandler(async (req, res) => {
    const wills = await prisma.will.findMany({
      where: req.user!.role === "ADMIN" ? {} : { executor: { userId: req.user!.id } },
      include: {
        testator: { select: { fullName: true, email: true } },
        beneficiaries: true,
        executor: true,
        inheritance: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ wills });
  })
);

export default router;
