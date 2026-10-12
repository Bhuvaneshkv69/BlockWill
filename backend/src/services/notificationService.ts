import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  willId?: string | null;
  sendEmail?: boolean;
}

/**
 * Creates an in-app notification and, optionally, an entry in the email
 * simulator (EmailLog). No real email provider is used - see
 * routes/notifications.routes.ts `GET /api/notifications/emails` and the
 * frontend "Email Simulator" panel.
 */
export async function notify(params: NotifyParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      willId: params.willId ?? null,
    },
  });

  if (params.sendEmail !== false) {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (user) {
      await prisma.emailLog.create({
        data: {
          recipient: user.email,
          subject: params.title,
          message: params.message,
          status: "SENT",
        },
      });
    }
  }

  return notification;
}
