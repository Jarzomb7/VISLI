import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalUsers,
    totalLicenses,
    activeLicenses,
    suspendedLicenses,
    totalSmsUsed,
    activeSubscriptions,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.license.count(),
    prisma.license.count({ where: { status: "ACTIVE" } }),
    prisma.license.count({ where: { status: "SUSPENDED" } }),
    prisma.sMSUsage.aggregate({ _sum: { used: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.aPILog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalLicenses,
    activeLicenses,
    suspendedLicenses,
    totalSmsUsed: totalSmsUsed._sum.used || 0,
    activeSubscriptions,
    apiRequestsLast24h: recentLogs,
  });
}
