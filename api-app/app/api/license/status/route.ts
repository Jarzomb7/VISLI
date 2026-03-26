import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { secured, type APICtx } from "@/lib/middleware";

export const POST = secured(async (ctx: APICtx) => {
  const { license } = ctx;

  const [sub, sms] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: license.userId } }),
    prisma.sMSUsage.findUnique({ where: { userId: license.userId } }),
  ]);

  return NextResponse.json({
    license: {
      status: license.status,
      plan: license.plan,
      domain: license.domain,
      expiresAt: license.expiresAt,
      killSwitch: license.killSwitch,
    },
    subscription: sub
      ? { status: sub.status, plan: sub.plan, currentPeriodEnd: sub.currentPeriodEnd }
      : null,
    sms: sms
      ? { used: sms.used, limit: sms.limit, remaining: Math.max(0, sms.limit - sms.used), resetDate: sms.resetDate }
      : null,
  });
});
