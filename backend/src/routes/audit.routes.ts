import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { getAuditTrail } from "../services/auditService";

const router = Router();
router.use(authenticate);

router.get(
  "/:willId",
  asyncHandler(async (req, res) => {
    const logs = await getAuditTrail(req.params.willId);
    res.json({ logs });
  })
);

export default router;
