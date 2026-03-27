import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/license";
import { z } from "zod";

const checkSchema = z.object({
  license_key: z.string().min(1),
  domain: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { license_key, domain } = checkSchema.parse(body);

    const signature = request.headers.get("x-license-signature");
    const secret = process.env.LICENSE_SECRET || "";

    if (signature && secret) {
      const payload = JSON.stringify({ license_key, domain });
      try {
        const valid = verifySignature(payload, signature, secret);
        if (!valid) {
          return NextResponse.json(
            { status: "invalid", message: "Invalid signature" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { status: "invalid", message: "Invalid signature format" },
          { status: 403 }
        );
      }
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: license_key },
    });

    if (!license) {
      return NextResponse.json({ status: "invalid", message: "License not found" });
    }

    if (license.domain.toLowerCase() !== domain.toLowerCase()) {
      return NextResponse.json({
        status: "invalid",
        message: "Domain mismatch",
      });
    }

    if (license.status === "expired" || new Date() > license.expiresAt) {
      if (license.status !== "expired") {
        await prisma.license.update({
          where: { id: license.id },
          data: { status: "expired" },
        });
      }
      return NextResponse.json({
        status: "expired",
        message: "License expired",
        plan: license.plan,
      });
    }

    if (license.status === "suspended") {
      return NextResponse.json({
        status: "invalid",
        message: "License suspended",
      });
    }

    return NextResponse.json({
      status: "active",
      plan: license.plan,
      expires_at: license.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { status: "invalid", message: "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}
