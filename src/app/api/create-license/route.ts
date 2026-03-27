import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateLicenseKey, getExpirationDate } from "@/lib/license";
import { z } from "zod";

const createSchema = z.object({
  domain: z.string().min(1),
  plan: z.enum(["basic", "pro"]),
  duration: z.enum(["1m", "3m", "6m", "12m"]),
  clientEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { domain, plan, duration, clientEmail } = createSchema.parse(body);

    let clientId: string | undefined;

    if (clientEmail) {
      const client = await prisma.client.upsert({
        where: { email: clientEmail },
        update: {},
        create: { email: clientEmail },
      });
      clientId = client.id;
    }

    const license = await prisma.license.create({
      data: {
        licenseKey: generateLicenseKey(),
        domain: domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, ""),
        plan,
        status: "active",
        expiresAt: getExpirationDate(duration),
        clientId,
      },
    });

    return NextResponse.json({ success: true, license });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
