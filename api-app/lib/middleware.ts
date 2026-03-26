import { NextRequest, NextResponse } from "next/server";
import prisma from "./prisma";
import {
  validateTimestamp,
  verifyRequestSignature,
  domainsMatch,
  checkRateLimit,
  logRequest,
} from "./security";
import { LicenseStatus, License } from "@prisma/client";

export interface PluginBody {
  licenseKey: string;
  apiKey: string;
  domain: string;
  timestamp: number;
  signature: string;
  [key: string]: unknown;
}

export interface APICtx {
  license: License;
  body: PluginBody;
  ip: string;
}

type Handler = (ctx: APICtx, req: NextRequest) => Promise<NextResponse>;

/**
 * Wraps a handler with the full security pipeline:
 *   1. JSON parse
 *   2. Timestamp (anti-replay)
 *   3. Required fields
 *   4. License lookup
 *   5. API key match
 *   6. Kill switch
 *   7. Status
 *   8. Expiry
 *   9. Domain match
 *  10. HMAC signature
 *  11. Rate limit
 *  12. Success log
 */
export function secured(handler: Handler) {
  return async (req: NextRequest) => {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ua = req.headers.get("user-agent") || "";
    const endpoint = new URL(req.url).pathname;

    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204 });
    }

    let body: PluginBody;
    try {
      body = await req.json();
    } catch {
      await logRequest({ endpoint, method: req.method, ip, statusCode: 400, message: "Bad JSON" });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.timestamp || !validateTimestamp(body.timestamp)) {
      await logRequest({ endpoint, method: req.method, ip, statusCode: 403, message: "Bad timestamp" });
      return NextResponse.json({ error: "Invalid or expired timestamp" }, { status: 403 });
    }

    if (!body.licenseKey || !body.apiKey) {
      await logRequest({ endpoint, method: req.method, ip, statusCode: 400, message: "Missing creds" });
      return NextResponse.json({ error: "Missing licenseKey or apiKey" }, { status: 400 });
    }

    const license = await prisma.license.findUnique({
      where: { licenseKey: body.licenseKey },
    });
    if (!license) {
      await logRequest({ endpoint, method: req.method, ip, statusCode: 404, message: "Not found" });
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    if (license.apiKey !== body.apiKey) {
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: "API key mismatch" });
      return NextResponse.json({ error: "Invalid API key" }, { status: 403 });
    }

    if (license.killSwitch) {
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: "Kill switch" });
      return NextResponse.json({ error: "License revoked" }, { status: 403 });
    }

    if (license.status !== LicenseStatus.ACTIVE) {
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: `Status: ${license.status}` });
      return NextResponse.json({ error: `License is ${license.status.toLowerCase()}` }, { status: 403 });
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      await prisma.license.update({ where: { id: license.id }, data: { status: "EXPIRED" } });
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: "Expired" });
      return NextResponse.json({ error: "License expired" }, { status: 403 });
    }

    if (license.domain && body.domain) {
      if (!domainsMatch(license.domain, body.domain)) {
        await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: `Domain mismatch: ${body.domain}` });
        return NextResponse.json({ error: "Domain mismatch" }, { status: 403 });
      }
    }

    if (!body.signature || !verifyRequestSignature(body as Record<string, unknown>, body.signature)) {
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 403, message: "Bad HMAC" });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const rl = await checkRateLimit(`lic:${license.id}`);
    if (!rl.allowed) {
      await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: 429, message: "Rate limited" });
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: rl.resetAt.toISOString() },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) } }
      );
    }

    const res = await handler({ license, body, ip }, req);

    await logRequest({ licenseId: license.id, endpoint, method: req.method, ip, userAgent: ua, statusCode: res.status, message: "OK" });
    res.headers.set("X-RateLimit-Remaining", String(rl.remaining));

    return res;
  };
}
