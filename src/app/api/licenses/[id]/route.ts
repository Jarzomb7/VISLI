import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  domain: z.string().min(1).optional(),
  plan: z.enum(["basic", "pro"]).optional(),
  status: z.enum(["active", "expired", "suspended"]).optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const license = await prisma.license.findUnique({
      where: { id: params.id },
      include: { client: { select: { id: true, email: true, name: true } } },
    });

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    return NextResponse.json({ license });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.domain) updateData.domain = data.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (data.plan) updateData.plan = data.plan;
    if (data.status) updateData.status = data.status;
    if (data.expiresAt) updateData.expiresAt = new Date(data.expiresAt);

    const license = await prisma.license.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, license });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.license.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
