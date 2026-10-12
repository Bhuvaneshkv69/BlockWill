import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import * as inheritanceService from "../services/inheritanceService";

const router = Router();
router.use(authenticate);

router.get(
  "/:willId",
  asyncHandler(async (req, res) => {
    const inheritance = await prisma.inheritance.findUnique({
      where: { willId: req.params.willId },
      include: { distributions: { include: { beneficiary: true } } },
    });
    if (!inheritance) throw AppError.notFound("No inheritance process has started for this will yet");
    res.json({ inheritance });
  })
);

router.post(
  "/:willId/start",
  asyncHandler(async (req, res) => {
    const inheritance = await inheritanceService.startInheritance(req.user!, req.params.willId);
    res.json({ inheritance });
  })
);

router.post(
  "/:willId/verify-beneficiary/:beneficiaryId",
  asyncHandler(async (req, res) => {
    const beneficiary = await inheritanceService.verifyBeneficiary(req.user!, req.params.willId, req.params.beneficiaryId);
    res.json({ beneficiary });
  })
);

router.post(
  "/:willId/execute",
  asyncHandler(async (req, res) => {
    const result = await inheritanceService.executeInheritance(req.user!, req.params.willId);
    res.json(result);
  })
);

export default router;
