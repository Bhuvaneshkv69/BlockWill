import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ notifications, unreadCount: notifications.filter((n) => !n.read).length });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.id) throw AppError.notFound("Notification not found");
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json({ notification: updated });
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    res.json({ success: true });
  })
);

/** Email simulator log — no real email provider is used anywhere in this project. */
router.get(
  "/emails",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const where = req.user!.role === "ADMIN" ? {} : { recipient: user.email };
    const emails = await prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ emails });
  })
);

export default router;
