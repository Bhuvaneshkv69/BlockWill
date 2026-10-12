import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { isChainReachable } from "../blockchain/provider";
import { isDeployed, loadDeployment } from "../blockchain/contracts";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [
      totalWills,
      activeWills,
      revokedWills,
      executedWills,
      pendingVerification,
      activeDisputes,
      totalBeneficiaries,
      totalUsers,
      willsByStatus,
      recentWills,
    ] = await Promise.all([
      prisma.will.count(),
      prisma.will.count({ where: { status: "ACTIVE" } }),
      prisma.will.count({ where: { status: "REVOKED" } }),
      prisma.will.count({ where: { status: "EXECUTED" } }),
      prisma.will.count({ where: { status: "DEATH_VERIFICATION_PENDING" } }),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.beneficiary.count(),
      prisma.user.count(),
      prisma.will.groupBy({ by: ["status"], _count: true }),
      prisma.will.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, status: true, createdAt: true, testator: { select: { fullName: true } } },
      }),
    ]);

    const assetAggregate = await prisma.asset.groupBy({ by: ["assetType"], _sum: { estimatedValue: true }, _count: true });

    res.json({
      totalWills,
      activeWills,
      revokedWills,
      executedWills,
      pendingVerification,
      activeDisputes,
      totalBeneficiaries,
      totalUsers,
      willsByStatus: willsByStatus.map((w) => ({ status: w.status, count: w._count })),
      assetsByType: assetAggregate.map((a) => ({ type: a.assetType, totalValue: a._sum.estimatedValue ?? 0, count: a._count })),
      recentWills,
    });
  })
);

router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, isDemoAccount: true, createdAt: true, wallets: { select: { address: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  })
);

router.get(
  "/contracts",
  asyncHandler(async (_req, res) => {
    const reachable = await isChainReachable();
    const deployed = isDeployed();
    res.json({
      reachable,
      deployed,
      contracts: deployed ? loadDeployment().contracts : null,
      network: deployed ? loadDeployment().network : null,
    });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit ?? 100), 500);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { fullName: true, role: true } }, will: { select: { title: true } } },
    });
    res.json({ logs });
  })
);

export default router;
