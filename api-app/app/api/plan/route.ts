import { NextResponse } from "next/server";
import { PLANS } from "@/lib/stripe";

export async function GET() {
  const plans = Object.entries(PLANS).map(([key, p]) => ({
    id: key,
    name: p.name,
    pricePLN: p.pricePLN,
    smsLimit: p.smsLimit,
    features: p.features,
  }));
  return NextResponse.json({ plans });
}
