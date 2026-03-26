import { createHmac, randomBytes } from "crypto";
import prisma from "./prisma";

const hmacSecret = () => process.env.API_HMAC_SECRET || "dev-hmac-secret";
const rateWindow = () => parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000");
const rateMax = () => parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "30");
const TS_TOLERANCE = 5 * 60 * 1000;

// ═══════════════════════════════════════════════
//  HMAC SIGNATURES
// ═══════════════════════════════════════════════

export function generateHMAC(payload: string, secret?: string): string {
  return createHmac("sha256", secret || hmacSecret())
    .update(payload)
    .digest("hex");
}

export function verifyHMAC(payload: string, signature: string, secret?: string): boolean {
  const expected = generateHMAC(payload, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ═══════════════════════════════════════════════
//  TIMESTAMP VALIDATION (anti-replay)
// ═══════════════════════════════════════════════

export function validateTimestamp(ts: string | number): boolean {
  const n = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (isNaN(n)) return false;
  return Math.abs(Date.now() - n) <= TS_TOLERANCE;
}

// ═══════════════════════════════════════════════
//  RATE LIMITER (DB-backed for Vercel)
// ═══════════════════════════════════════════════

export async function checkRateLimit(id: string) {
  const window = rateWindow();
  const max = rateMax();
  const now = new Date();
  const cutoff = new Date(now.getTime() - window);

  try {
    const row = await prisma.rateLimit.findUnique({ where: { id } });

    if (!row || row.windowStart < cutoff) {
      await prisma.rateLimit.upsert({
        where: { id },
        create: { id, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { allowed: true, remaining: max - 1, resetAt: new Date(now.getTime() + window) };
    }

    if (row.count >= max) {
      return { allowed: false, remaining: 0, resetAt: new Date(row.windowStart.getTime() + window) };
    }

    await prisma.rateLimit.update({ where: { id }, data: { count: { increment: 1 } } });
    return {
      allowed: true,
      remaining: max - row.count - 1,
      resetAt: new Date(row.windowStart.getTime() + window),
    };
  } catch {
    return { allowed: true, remaining: max, resetAt: now };
  }
}

// ═══════════════════════════════════════════════
//  KEY GENERATORS
// ═══════════════════════════════════════════════

export function generateLicenseKey(): string {
  const seg = () => randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  return `VISLI-${seg()}-${seg()}-${seg()}-${seg()}`;
}

export function generateApiKey(): string {
  return `vsk_${randomBytes(32).toString("hex")}`;
}

// ═══════════════════════════════════════════════
//  DOMAIN HELPERS
// ═══════════════════════════════════════════════

export function normalizeDomain(d: string): string {
  return d.toLowerCase().trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:.*$/, "");
}

export function domainsMatch(expected: string, incoming: string): boolean {
  return normalizeDomain(expected) === normalizeDomain(incoming);
}

// ═══════════════════════════════════════════════
//  REQUEST SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════

export function verifyRequestSignature(body: Record<string, unknown>, signature: string): boolean {
  const { signature: _s, ...rest } = body;
  const payload = JSON.stringify(rest, Object.keys(rest).sort());
  return verifyHMAC(payload, signature);
}

// ═══════════════════════════════════════════════
//  API LOGGING
// ═══════════════════════════════════════════════

export async function logRequest(p: {
  licenseId?: string;
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
  statusCode: number;
  message?: string;
}) {
  try {
    await prisma.aPILog.create({ data: p });
  } catch (e) {
    console.error("Log write failed:", e);
  }
}
