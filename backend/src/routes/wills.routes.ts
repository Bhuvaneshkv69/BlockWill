import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { ConditionType } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import * as willService from "../services/willService";
import { getAuditTrail } from "../services/auditService";
import { sha256Hex } from "../crypto/hash";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

function serializeWill(will: any) {
  return {
    id: will.id,
    onChainId: will.onChainId,
    title: will.title,
    status: will.status,
    version: will.version,
    documentHash: will.documentHash,
    network: will.network,
    registeredTxHash: will.registeredTxHash,
    createdAt: will.createdAt,
    updatedAt: will.updatedAt,
    finalizedAt: will.finalizedAt,
    revokedAt: will.revokedAt,
    testator: will.testator,
    beneficiaries: will.beneficiaries,
    assets: will.assets,
    executor: will.executor,
    witnesses: will.witnesses,
    conditions: will.conditions,
    documents: will.documents?.map((d: any) => ({
      id: d.id,
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
      sha256Hash: d.sha256Hash,
      version: d.version,
      uploadedAt: d.uploadedAt,
    })),
    inheritance: will.inheritance,
    disputes: will.disputes,
  };
}

/** Restricts what a non-owner beneficiary can see before the will is verified. */
function applyVisibility(will: any, userId: string, role: string) {
  const isTestator = will.testatorId === userId;
  const isExecutor = will.executor?.userId === userId;
  const isPrivileged = isTestator || isExecutor || role === "ADMIN" || role === "AUTHORITY";
  if (isPrivileged) return serializeWill(will);

  const isPreVerification = !["VERIFIED", "INHERITANCE_IN_PROGRESS", "EXECUTED"].includes(will.status);
  if (isPreVerification) {
    const own = will.beneficiaries.find((b: any) => b.userId === userId);
    return {
      ...serializeWill(will),
      beneficiaries: own ? [own] : [],
      documents: [],
      assets: [],
      restricted: true,
      restrictionReason: "Full will contents are hidden from beneficiaries until death verification is complete.",
    };
  }
  return serializeWill(will);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;
    const where =
      role === "ADMIN"
        ? {}
        : role === "TESTATOR"
        ? { testatorId: userId }
        : role === "EXECUTOR"
        ? { executor: { userId } }
        : role === "BENEFICIARY"
        ? { beneficiaries: { some: { userId } } }
        : role === "WITNESS"
        ? { witnesses: { some: { userId } } }
        : role === "AUTHORITY"
        ? {}
        : { testatorId: userId };

    const wills = await prisma.will.findMany({
      where,
      include: { testator: { select: { id: true, fullName: true, email: true } }, beneficiaries: true, executor: true, witnesses: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ wills: wills.map(serializeWill) });
  })
);

router.post(
  "/",
  requireRole("TESTATOR"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ title: z.string().min(1).max(200).optional() });
    const input = schema.parse(req.body);
    const will = await willService.createWill(req.user!, input.title ?? "Last Will & Testament");
    res.status(201).json({ will });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const will = await willService.getWillOrThrow(req.params.id);
    res.json({ will: applyVisibility(will, req.user!.id, req.user!.role) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const will = await willService.getWillOrThrow(req.params.id);
    if (will.testatorId !== req.user!.id) throw AppError.forbidden("Only the testator can edit this will");
    if (will.status !== "DRAFT") throw AppError.badRequest("Only draft wills can be edited");
    const schema = z.object({ title: z.string().min(1).max(200) });
    const input = schema.parse(req.body);
    const updated = await prisma.will.update({ where: { id: will.id }, data: { title: input.title } });
    res.json({ will: updated });
  })
);

router.post(
  "/:id/beneficiaries",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address"),
      relationship: z.string().min(1),
      allocationPercent: z.number().positive().max(100),
      identityReference: z.string().optional(),
      conditionType: z.nativeEnum(ConditionType).optional(),
      conditionParam: z.string().datetime().optional(),
    });
    const input = schema.parse(req.body);
    const beneficiary = await willService.addBeneficiary(req.user!, req.params.id, {
      ...input,
      conditionParam: input.conditionParam ? new Date(input.conditionParam) : null,
    });
    res.status(201).json({ beneficiary });
  })
);

router.delete(
  "/:id/beneficiaries/:beneficiaryId",
  asyncHandler(async (req, res) => {
    const will = await willService.getWillOrThrow(req.params.id);
    if (will.testatorId !== req.user!.id) throw AppError.forbidden();
    if (will.status !== "DRAFT") throw AppError.badRequest("Beneficiaries can only be removed while in DRAFT (on-chain allocations are immutable once a will is finalized)");
    await prisma.beneficiary.delete({ where: { id: req.params.beneficiaryId } });
    res.status(204).send();
  })
);

router.post(
  "/:id/assets",
  asyncHandler(async (req, res) => {
    const will = await willService.getWillOrThrow(req.params.id);
    if (will.testatorId !== req.user!.id) throw AppError.forbidden();
    if (will.status !== "DRAFT") throw AppError.badRequest("Assets can only be added while the will is in DRAFT");
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      assetType: z.enum(["CRYPTOCURRENCY", "BANK_ACCOUNT", "PROPERTY", "VEHICLE", "DIGITAL_ASSET", "OTHER"]),
      estimatedValue: z.number().nonnegative(),
      beneficiaryId: z.string().optional(),
    });
    const input = schema.parse(req.body);
    const asset = await prisma.asset.create({ data: { willId: will.id, ...input } });
    res.status(201).json({ asset });
  })
);

router.post(
  "/:id/executor",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      email: z.string().email(),
      relationship: z.string().min(1),
      userId: z.string().optional(),
    });
    const input = schema.parse(req.body);
    const executor = await willService.nominateExecutor(req.user!, req.params.id, input);
    res.status(201).json({ executor });
  })
);

router.post(
  "/:id/executor/approve",
  asyncHandler(async (req, res) => {
    const executor = await willService.executorApprove(req.user!, req.params.id);
    res.json({ executor });
  })
);

router.post(
  "/:id/witnesses",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      email: z.string().email().optional(),
      userId: z.string().optional(),
    });
    const input = schema.parse(req.body);
    const witness = await willService.addWitness(req.user!, req.params.id, input);
    res.status(201).json({ witness });
  })
);

router.post(
  "/:id/witnesses/:witnessId/sign",
  asyncHandler(async (req, res) => {
    const witness = await willService.signAsWitness(req.user!, req.params.id, req.params.witnessId);
    res.json({ witness });
  })
);

router.post(
  "/:id/conditions",
  asyncHandler(async (req, res) => {
    const will = await willService.getWillOrThrow(req.params.id);
    if (will.testatorId !== req.user!.id) throw AppError.forbidden();
    const schema = z.object({
      description: z.string().min(1),
      type: z.nativeEnum(ConditionType),
      param: z.string().datetime().optional(),
    });
    const input = schema.parse(req.body);
    const condition = await prisma.condition.create({
      data: { willId: will.id, description: input.description, type: input.type, param: input.param ? new Date(input.param) : null },
    });
    res.status(201).json({ condition });
  })
);

router.post(
  "/:id/documents",
  upload.single("document"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("A document file is required");
    if (req.file.mimetype !== "application/pdf" && req.file.mimetype !== "text/plain") {
      throw AppError.badRequest("Only PDF documents are accepted (text/plain is allowed for demo generation)");
    }
    const document = await willService.uploadDocument(req.user!, req.params.id, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
    });
    res.status(201).json({ document });
  })
);

router.post(
  "/:id/deposit",
  asyncHandler(async (req, res) => {
    const schema = z.object({ amount: z.number().positive() });
    const input = schema.parse(req.body);
    const record = await willService.depositEscrow(req.user!, req.params.id, input.amount);
    res.json({ txHash: record.txHash });
  })
);

router.post(
  "/:id/finalize",
  asyncHandler(async (req, res) => {
    const will = await willService.finalizeWill(req.user!, req.params.id);
    res.json({ will });
  })
);

router.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    const will = await willService.revokeWill(req.user!, req.params.id);
    res.json({ will });
  })
);

router.get(
  "/:id/audit",
  asyncHandler(async (req, res) => {
    const logs = await getAuditTrail(req.params.id);
    res.json({ logs });
  })
);

router.post(
  "/:id/verify-document",
  upload.single("document"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("A document file is required");
    const will = await willService.getWillOrThrow(req.params.id);
    const computedHash = sha256Hex(req.file.buffer);
    const onChainHash = will.documentHash?.replace(/^0x/, "");
    const match = onChainHash === computedHash;
    res.json({ match, computedHash, onChainHash: will.documentHash });
  })
);

export default router;
