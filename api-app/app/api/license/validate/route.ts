import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { secured, type APICtx } from "@/lib/middleware";

export const POST = secured(async (ctx: APICtx) => {
  const { license } = ctx;

  await prisma.license.update({
    where: { id: license.id },
    data: { lastValidated: new Date() },
  });

  const sms = await prisma.sMSUsage.findUnique({ where: { userId: license.userId } });

  return NextResponse.json({
    valid: true,
    license: {
      status: license.status,
      plan: license.plan,
      domain: license.domain,
      expiresAt: license.expiresAt,
    },
    sms: sms
      ? { used: sms.used, limit: sms.limit, remaining: Math.max(0, sms.limit - sms.used) }
      : null,
    nextValidationMs: Math.floor((4 * 60 + Math.random() * 4 * 60) * 60 * 1000),
  });
});
