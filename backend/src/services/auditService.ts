import { Request } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";

interface LogParams {
  willId?: string | null;
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  details?: Record<string, unknown>;
  txHash?: string | null;
  blockNumber?: number | null;
  req?: Request;
}

/** Appends an immutable audit record. Never updated or deleted once written. */
export async function logAudit(params: LogParams) {
  return prisma.auditLog.create({
    data: {
      willId: params.willId ?? null,
      actorId: params.actorId ?? null,
      actorRole: params.actorRole ?? null,
      action: params.action,
      details: (params.details as Prisma.InputJsonValue) ?? undefined,
      txHash: params.txHash ?? null,
      blockNumber: params.blockNumber ?? null,
      ipAddress: params.req?.ip ?? null,
      userAgent: params.req?.headers["user-agent"] ?? null,
    },
  });
}

export async function getAuditTrail(willId: string) {
  return prisma.auditLog.findMany({
    where: { willId },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, fullName: true, role: true, email: true } } },
  });
}
