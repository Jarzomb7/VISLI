import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20"));
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { licenseKey: { contains: search, mode: "insensitive" } },
      { domain: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [licenses, total] = await Promise.all([
    prisma.license.findMany({
      where,
      include: { user: { select: { email: true, smsUsage: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.license.count({ where }),
  ]);

  return NextResponse.json({
    licenses: licenses.map((l) => ({
      id: l.id,
      licenseKey: l.licenseKey,
      apiKey: l.apiKey,
      domain: l.domain,
      status: l.status,
      plan: l.plan,
      killSwitch: l.killSwitch,
      expiresAt: l.expiresAt,
      lastValidated: l.lastValidated,
      createdAt: l.createdAt,
      userEmail: l.user.email,
      smsUsage: l.user.smsUsage
        ? { used: l.user.smsUsage.used, limit: l.user.smsUsage.limit }
        : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
