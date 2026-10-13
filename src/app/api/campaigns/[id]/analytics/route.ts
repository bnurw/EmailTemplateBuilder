import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id: campaignId } = await context.params;

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found or unauthorized." }, { status: 404 });
    }

    const [
      totalRecipients,
      pending,
      sent,
      delivered,
      bounced,
      failed,
      skipped,
      opens,
      clicks,
    ] = await prisma.$transaction([
      prisma.campaignRecipient.count({ where: { campaignId } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "SENT" } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "DELIVERED" } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "BOUNCED" } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "FAILED" } }),
      prisma.campaignRecipient.count({ where: { campaignId, status: "SKIPPED" } }),
      prisma.emailEvent.count({ where: { campaignId, type: "OPEN" } }),
      prisma.clickEvent.count({ where: { campaignId } }),
    ]);

    return NextResponse.json({
      campaignId,
      metrics: {
        totalRecipients,
        pending,
        sent,
        delivered,
        bounced,
        failed,
        skipped,
        opens,
        uniqueOpens: Math.min(opens, delivered || sent || 1),
        clicks,
        uniqueClicks: Math.min(clicks, delivered || sent || 1),
        openRate: delivered > 0 ? ((opens / delivered) * 100).toFixed(1) : "0.0",
        clickRate: delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : "0.0",
      },
    });
  } catch (error) {
    console.error("Failed to load campaign analytics:", error);
    return NextResponse.json({ error: "Unable to load analytics." }, { status: 500 });
  }
}
