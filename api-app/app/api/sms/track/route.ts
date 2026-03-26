import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { secured, type APICtx } from "@/lib/middleware";

function firstOfNextMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export const POST = secured(async (ctx: APICtx) => {
  const { license, body } = ctx;
  const count = typeof body.count === "number" ? body.count : 1;

  if (count < 1 || count > 100) {
    return NextResponse.json({ error: "count must be 1–100" }, { status: 400 });
  }

  let sms = await prisma.sMSUsage.findUnique({ where: { userId: license.userId } });

  if (!sms) {
    sms = await prisma.sMSUsage.create({
      data: { userId: license.userId, used: 0, limit: 100, resetDate: firstOfNextMonth() },
    });
  }

  if (new Date() > sms.resetDate) {
    sms = await prisma.sMSUsage.update({
      where: { id: sms.id },
      data: { used: 0, resetDate: firstOfNextMonth() },
    });
  }

  const remaining = sms.limit - sms.used;
  if (remaining < count) {
    return NextResponse.json(
      { error: "SMS limit exceeded", used: sms.used, limit: sms.limit, remaining: Math.max(0, remaining) },
      { status: 429 }
    );
  }

  const updated = await prisma.sMSUsage.update({
    where: { id: sms.id },
    data: { used: { increment: count } },
  });

  return NextResponse.json({
    success: true,
    sms: { used: updated.used, limit: updated.limit, remaining: updated.limit - updated.used, resetDate: updated.resetDate },
  });
});
