import { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import willsRoutes from "./wills.routes";
import beneficiariesRoutes from "./beneficiaries.routes";
import executorRoutes from "./executor.routes";
import witnessRoutes from "./witness.routes";
import verificationRoutes from "./verification.routes";
import inheritanceRoutes from "./inheritance.routes";
import disputesRoutes from "./disputes.routes";
import documentsRoutes from "./documents.routes";
import blockchainRoutes from "./blockchain.routes";
import auditRoutes from "./audit.routes";
import notificationsRoutes from "./notifications.routes";
import adminRoutes from "./admin.routes";
import demoRoutes from "./demo.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/wills", willsRoutes);
router.use("/beneficiaries", beneficiariesRoutes);
router.use("/executor", executorRoutes);
router.use("/witness", witnessRoutes);
router.use("/verification", verificationRoutes);
router.use("/inheritance", inheritanceRoutes);
router.use("/disputes", disputesRoutes);
router.use("/documents", documentsRoutes);
router.use("/blockchain", blockchainRoutes);
router.use("/audit", auditRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/admin", adminRoutes);
router.use("/demo", demoRoutes);

export default router;
