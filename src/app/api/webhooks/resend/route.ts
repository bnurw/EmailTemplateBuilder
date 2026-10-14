import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "fallback_secret";

async function verifyResendSignature(request: NextRequest, body: string) {
  const signature = request.headers.get("webhook-signature");
  if (!signature) return false;

  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(body);
  const digest = hmac.digest("hex");
  return signature === digest;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!(await verifyResendSignature(request, rawBody))) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const eventType = body?.type;
  const data = body?.data;
  const messageId = data?.email_id || data?.messageId;

  if (!eventType) {
    return NextResponse.json({ error: "Missing event type." }, { status: 400 });
  }

  try {
    // Check if event already processed (idempotency)
    const existing = await prisma.emailEvent.findMany({
      where: { messageId: messageId || "unknown", type: eventType },
    });

    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: "Duplicate event skipped." });
    }

    if (eventType === "email.delivered") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "DELIVERED", messageId: messageId || "unknown" },
      });
    } else if (eventType === "email.bounced") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "BOUNCED", messageId: messageId || "unknown" },
      });
      // Automatically suppress bounced addresses
      if (data?.email) {
        await prisma.suppression.create({
          data: { email: data.email, reason: 'BOUNCED' },
        });
      }
    } else if (eventType === "email.complained") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "COMPLAINT", messageId: messageId || "unknown" },
      });
      // Automatically suppress complained addresses
      if (data?.email) {
        await prisma.suppression.create({
          data: { email: data.email, reason: 'COMPLAINED' },
        });
      }
    } else if (eventType === "email.opened") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "OPEN", messageId: messageId || "unknown" },
      });
    } else if (eventType === "email.clicked") {
      await prisma.clickEvent.create({
        data: { campaignId: "camp-1", url: data?.url || "https://example.com" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing error." }, { status: 500 });
  }
}
