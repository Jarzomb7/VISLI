import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

export function generateLicenseKey(): string {
  const raw = uuidv4().replace(/-/g, "").toUpperCase();
  return `VISLI-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

export function computeSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = computeSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

export function getExpirationDate(
  duration: "1m" | "3m" | "6m" | "12m"
): Date {
  const now = new Date();
  const months: Record<string, number> = {
    "1m": 1,
    "3m": 3,
    "6m": 6,
    "12m": 12,
  };
  now.setMonth(now.getMonth() + (months[duration] || 1));
  return now;
}
