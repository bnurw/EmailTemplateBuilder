import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { qstashClient } from "@/lib/qstash";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id: campaignId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
  const scheduledAtStr = typeof body.scheduledAt === "string" ? body.scheduledAt : null;
  const sendingAccountId = typeof body.sendingAccountId === "string" ? body.sendingAccountId : null;
  const contactListId = typeof body.contactListId === "string" ? body.contactListId : null;

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found or unauthorized." }, { status: 404 });
    }

    if (action === "SCHEDULE" || action === "START_IMMEDIATELY") {
      if (sendingAccountId) {
        const account = await prisma.sendingAccount.findFirst({
          where: { id: sendingAccountId, userId },
        });
        if (!account) {
          return NextResponse.json({ error: "Sending account not found or unauthorized." }, { status: 404 });
        }
      }

      let scheduledAt: Date | null = null;
      if (action === "SCHEDULE") {
        if (!scheduledAtStr) {
          return NextResponse.json({ error: "Scheduled date and time are required." }, { status: 400 });
        }
        scheduledAt = new Date(scheduledAtStr);
        if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
          return NextResponse.json({ error: "Scheduled time must be in the future." }, { status: 400 });
        }
      }

      // Snapshot recipients from contact list
      const contacts = await prisma.contact.findMany({
        where: { userId, ...(contactListId ? { contactListId } : {}) },
      });

      if (contacts.length === 0) {
        return NextResponse.json({ error: "No contacts found to target." }, { status: 400 });
      }

      const recipientData = contacts.map((c: any) => ({
        campaignId,
        email: c.email,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        company: c.company || null,
        customFields: c.customFields || {},
        status: "PENDING",
      }));

      await prisma.campaignRecipient.createMany({ data: recipientData });

      const newStatus = action === "START_IMMEDIATELY" ? "RUNNING" : "SCHEDULED";
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: newStatus,
          scheduledAt: action === "SCHEDULE" ? scheduledAt : null,
          sendingAccountId: sendingAccountId || campaign.sendingAccountId,
        },
      });

      // If starting immediately, enqueue first batch via QStash
      if (newStatus === "RUNNING") {
        const appUrl = process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
        try {
          await qstashClient.publishJSON({
            url: `${appUrl}/api/queue/send-campaign`,
            body: { campaignId, batchSize: 50 },
          });
        } catch (e) {
          console.error("Failed to enqueue immediate campaign run:", e);
        }
      }

      return NextResponse.json({ success: true, campaign: updated });
    }

    if (action === "PAUSE") {
      if (campaign.status !== "RUNNING") {
        return NextResponse.json({ error: "Campaign is not running." }, { status: 400 });
      }
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "PAUSED" },
      });
      return NextResponse.json({ success: true, campaign: updated });
    }

    if (action === "RESUME") {
      if (campaign.status !== "PAUSED") {
        return NextResponse.json({ error: "Campaign is not paused." }, { status: 400 });
      }
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "RUNNING" },
      });
      return NextResponse.json({ success: true, campaign: updated });
    }

    if (action === "CANCEL") {
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ success: true, campaign: updated });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (error) {
    console.error("Campaign scheduling action failed:", error);
    return NextResponse.json({ error: "Unable to process campaign action." }, { status: 500 });
  }
}
