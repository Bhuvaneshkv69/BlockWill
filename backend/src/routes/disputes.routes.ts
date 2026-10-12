import { Router } from "express";
import { z } from "zod";
import { DisputeReason, WillStatus } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import * as willService from "../services/willService";
import { notify } from "../services/notificationService";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;
    const where = role === "ADMIN" || role === "EXECUTOR" ? {} : { raisedById: userId };
    const disputes = await prisma.dispute.findMany({
      where,
      include: { will: { select: { id: true, title: true, status: true } }, raisedBy: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ disputes });
  })
);

router.post(
  "/",
  requireRole("BENEFICIARY"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      willId: z.string(),
      reason: z.nativeEnum(DisputeReason),
      description: z.string().min(10),
    });
    const input = schema.parse(req.body);
    const dispute = await willService.raiseDispute(req.user!, input.willId, input.reason, input.description);

    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const admin of admins) {
      await notify({
        userId: admin.id,
        type: "DISPUTE_RAISED",
        title: "A dispute has been raised",
        message: `${req.user!.fullName} raised a dispute: ${input.reason}`,
        willId: input.willId,
      });
    }

    res.status(201).json({ dispute });
  })
);

router.post(
  "/:id/resolve",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      reinstate: z.boolean(),
      restoreToStatus: z.nativeEnum(WillStatus).default("VERIFIED"),
    });
    const input = schema.parse(req.body);
    const dispute = await willService.resolveDispute(req.user!, req.params.id, input.reinstate, input.restoreToStatus);
    res.json({ dispute });
  })
);

export default router;
