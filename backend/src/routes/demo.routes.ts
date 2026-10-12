import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";
import * as demoService from "../services/demoService";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const will = await demoService.getDemoStatus();
    res.json({ will });
  })
);

const steps: Record<string, () => Promise<unknown>> = {
  "1": demoService.step1_createDemoWill,
  "2": demoService.step2_generateDocumentHash,
  "3": demoService.step3_simulateWitnessSignatures,
  "4": demoService.step4_registerOnBlockchain,
  "5": demoService.step5_simulateDeathCertificate,
  "6": demoService.step6_authorityApprovesDeath,
  "7": demoService.step7_executorApproves,
  "8": demoService.step8_verifyBeneficiaries,
  "9": demoService.step9_executeSmartContract,
  "10": demoService.step10_distributeAssets,
  "11": demoService.step11_viewAuditTrail,
  "12": demoService.step12_resetDemo,
};

router.post(
  "/step/:n",
  asyncHandler(async (req, res) => {
    const fn = steps[req.params.n];
    if (!fn) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Unknown demo step" } });
    const result = await fn();
    res.json({ step: Number(req.params.n), result });
  })
);

export default router;
