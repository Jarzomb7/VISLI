import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [totalClients, totalLicenses, activeLicenses, expiredLicenses, recentLicenses] =
      await Promise.all([
        prisma.client.count(),
        prisma.license.count(),
        prisma.license.count({ where: { status: "active" } }),
        prisma.license.count({ where: { status: "expired" } }),
        prisma.license.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { client: { select: { email: true } } },
        }),
      ]);

    return NextResponse.json({
      totalClients,
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      recentLicenses,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
