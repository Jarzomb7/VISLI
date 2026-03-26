import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, smsLimit, plan } = body;

  const license = await prisma.license.findUnique({ where: { id } });
  if (!license) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  switch (action) {
    case "activate":
      await prisma.license.update({ where: { id }, data: { status: "ACTIVE", killSwitch: false } });
      break;

    case "deactivate":
      await prisma.license.update({ where: { id }, data: { status: "INACTIVE" } });
      break;

    case "suspend":
      await prisma.license.update({ where: { id }, data: { status: "SUSPENDED" } });
      break;

    case "kill":
      await prisma.license.update({ where: { id }, data: { killSwitch: true, status: "SUSPENDED" } });
      break;

    case "unkill":
      await prisma.license.update({ where: { id }, data: { killSwitch: false } });
      break;

    case "change_plan":
      if (!plan || !["STARTER", "PRO", "ENTERPRISE"].includes(plan)) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      await prisma.license.update({ where: { id }, data: { plan } });
      break;

    case "update_sms":
      if (typeof smsLimit !== "number" || smsLimit < 0) {
        return NextResponse.json({ error: "Invalid smsLimit" }, { status: 400 });
      }
      await prisma.sMSUsage.upsert({
        where: { userId: license.userId },
        create: {
          userId: license.userId,
          used: 0,
          limit: smsLimit,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
        update: { limit: smsLimit },
      });
      break;

    case "reset_sms":
      await prisma.sMSUsage.updateMany({
        where: { userId: license.userId },
        data: { used: 0 },
      });
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.license.findUnique({
    where: { id },
    include: { user: { include: { smsUsage: true, subscription: true } } },
  });

  return NextResponse.json({ success: true, license: updated });
}
