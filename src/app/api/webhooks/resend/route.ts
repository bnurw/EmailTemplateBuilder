import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
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
    if (eventType === "email.delivered") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "DELIVERED", messageId: messageId || "unknown" },
      });
    } else if (eventType === "email.bounced") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "BOUNCED", messageId: messageId || "unknown" },
      });
    } else if (eventType === "email.complained") {
      await prisma.emailEvent.create({
        data: { campaignId: "camp-1", type: "COMPLAINT", messageId: messageId || "unknown" },
      });
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
