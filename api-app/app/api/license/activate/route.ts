import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { secured, type APICtx } from "@/lib/middleware";
import { normalizeDomain } from "@/lib/security";

export const POST = secured(async (ctx: APICtx) => {
  const { license, body } = ctx;

  if (!body.domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain as string);

  const conflict = await prisma.license.findFirst({
    where: { domain, id: { not: license.id }, status: "ACTIVE" },
  });
  if (conflict) {
    return NextResponse.json({ error: "Domain already registered to another license" }, { status: 409 });
  }

  const updated = await prisma.license.update({
    where: { id: license.id },
    data: { domain, status: "ACTIVE", lastValidated: new Date() },
  });

  return NextResponse.json({
    success: true,
    license: {
      licenseKey: updated.licenseKey,
      domain: updated.domain,
      status: updated.status,
      plan: updated.plan,
      expiresAt: updated.expiresAt,
    },
  });
});
