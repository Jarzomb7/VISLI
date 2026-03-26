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

  const { id: userId } = await params;
  const body = await req.json();
  const { action, amount } = body;

  const sms = await prisma.sMSUsage.findUnique({ where: { userId } });
  if (!sms) {
    return NextResponse.json({ error: "SMS record not found" }, { status: 404 });
  }

  switch (action) {
    case "set_limit":
      if (typeof amount !== "number" || amount < 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      await prisma.sMSUsage.update({ where: { userId }, data: { limit: amount } });
      break;

    case "topup":
      if (typeof amount !== "number" || amount < 1) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      await prisma.sMSUsage.update({ where: { userId }, data: { limit: { increment: amount } } });
      break;

    case "reset":
      await prisma.sMSUsage.update({ where: { userId }, data: { used: 0 } });
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.sMSUsage.findUnique({ where: { userId } });
  return NextResponse.json({ success: true, smsUsage: updated });
}
