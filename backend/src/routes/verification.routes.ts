import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import * as verificationService from "../services/verificationService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

/** ACADEMIC SIMULATION — not a real government death-registry integration. */

router.get(
  "/pending",
  requireRole("AUTHORITY", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const requests = await verificationService.pendingRequests();
    res.json({ requests, disclaimer: "ACADEMIC SIMULATION — NOT A REAL GOVERNMENT INTEGRATION" });
  })
);

router.get(
  "/",
  requireRole("AUTHORITY", "ADMIN"),
  asyncHandler(async (_req, res) => {
    const requests = await prisma.verificationRequest.findMany({
      include: { will: { include: { testator: { select: { fullName: true, email: true } } } } },
      orderBy: { requestedAt: "desc" },
    });
    res.json({ requests });
  })
);

router.post(
  "/",
  requireRole("AUTHORITY", "ADMIN"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ willId: z.string(), notes: z.string().optional() });
    const input = schema.parse(req.body);
    const request = await verificationService.requestVerification(req.user!, input.willId, input.notes);
    res.status(201).json({ request });
  })
);

router.post(
  "/:id/certificate",
  requireRole("AUTHORITY", "ADMIN"),
  upload.single("certificate"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("A mock certificate file is required");
    const request = await verificationService.attachCertificateHash(req.params.id, req.file.originalname, req.file.buffer);
    res.json({ request });
  })
);

router.post(
  "/:id/approve",
  requireRole("AUTHORITY", "ADMIN"),
  asyncHandler(async (req, res) => {
    const request = await verificationService.decideVerification(req.user!, req.params.id, true);
    res.json({ request });
  })
);

router.post(
  "/:id/reject",
  requireRole("AUTHORITY", "ADMIN"),
  asyncHandler(async (req, res) => {
    const request = await verificationService.decideVerification(req.user!, req.params.id, false);
    res.json({ request });
  })
);

export default router;
