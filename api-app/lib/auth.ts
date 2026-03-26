import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { NextRequest } from "next/server";
import prisma from "./prisma";

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-fallback-change-me");

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireAdmin(req: NextRequest): Promise<SessionPayload> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("No token");

  const session = await verifyToken(auth.slice(7));
  if (!session || session.role !== "ADMIN") throw new Error("Forbidden");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "ADMIN") throw new Error("Forbidden");

  return session;
}
