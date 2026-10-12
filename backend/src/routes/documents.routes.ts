import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { AppError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { sha256Hex } from "../crypto/hash";
import { decryptDocument } from "../services/willService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { id: userId, role } = req.user!;
    const wills =
      role === "ADMIN"
        ? await prisma.will.findMany({ include: { documents: true, testator: { select: { fullName: true } } } })
        : await prisma.will.findMany({
            where: { testatorId: userId },
            include: { documents: true, testator: { select: { fullName: true } } },
          });

    const documents = wills.flatMap((w) =>
      w.documents.map((d) => ({
        id: d.id,
        willId: w.id,
        willTitle: w.title,
        testator: w.testator.fullName,
        fileName: d.fileName,
        sha256Hash: d.sha256Hash,
        version: d.version,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt,
      }))
    );
    res.json({ documents });
  })
);

router.get(
  "/:id/download",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id }, include: { will: true } });
    if (!document) throw AppError.notFound("Document not found");
    if (document.will.testatorId !== req.user!.id && req.user!.role !== "ADMIN") {
      throw AppError.forbidden("Only the testator may download the original document");
    }
    const plaintext = decryptDocument(document);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
    res.send(plaintext);
  })
);

router.post(
  "/verify",
  upload.single("document"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest("A document file is required");
    const willId = req.body.willId as string | undefined;
    if (!willId) throw AppError.badRequest("willId is required to verify against the on-chain hash");

    const will = await prisma.will.findUnique({ where: { id: willId } });
    if (!will) throw AppError.notFound("Will not found");

    const computedHash = sha256Hex(req.file.buffer);
    const onChainHash = (will.documentHash ?? "").replace(/^0x/, "");
    const match = computedHash === onChainHash;

    res.json({
      match,
      result: match ? "MATCH" : "DOCUMENT_MODIFIED",
      computedHash,
      onChainHash: will.documentHash,
    });
  })
);

export default router;
