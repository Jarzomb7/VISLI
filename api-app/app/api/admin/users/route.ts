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
  const search = url.searchParams.get("search") || "";

  const where = search
    ? { email: { contains: search, mode: "insensitive" as const } }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { licenses: true, subscription: true, smsUsage: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      licenses: u.licenses.map((l) => ({
        id: l.id,
        licenseKey: l.licenseKey,
        apiKey: l.apiKey,
        domain: l.domain,
        status: l.status,
        plan: l.plan,
        killSwitch: l.killSwitch,
        expiresAt: l.expiresAt,
        lastValidated: l.lastValidated,
      })),
      subscription: u.subscription
        ? { status: u.subscription.status, plan: u.subscription.plan, currentPeriodEnd: u.subscription.currentPeriodEnd }
        : null,
      smsUsage: u.smsUsage
        ? { used: u.smsUsage.used, limit: u.smsUsage.limit, resetDate: u.smsUsage.resetDate }
        : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
