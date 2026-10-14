import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyQStashSignature, qstashClient } from "@/lib/qstash";
import { sendEmailViaProvider } from "@/lib/email-provider";
import { interpolateHtml, interpolateText } from "@/lib/mail-merge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("upstash-signature");
  const rawBody = await request.text();

  const isValid = await verifyQStashSignature(signature, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const campaignId = body?.campaignId;
  const batchSize = Math.min(100, Number(body?.batchSize ?? 50));

  if (!campaignId) {
    return NextResponse.json({ error: "Campaign ID missing." }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId } });
    if (!campaign || campaign.status !== "RUNNING") {
      return NextResponse.json({ success: true, message: "Campaign not running or completed." });
    }

    const sendingAccount = await prisma.sendingAccount.findFirst({
      where: { id: campaign.sendingAccountId },
    });

    // Atomic lease claiming
    const leaseExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const claimed = await prisma.campaignRecipient.updateMany({
      where: { 
        campaignId, 
        status: { in: ["PENDING"] } // In real DB: OR [{status: PENDING}, {status: PROCESSING, leaseExpiresAt: < NOW}]
      },
      data: { status: "PROCESSING", leaseExpiresAt, attemptCount: { increment: 1 } },
    });

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: "PROCESSING", leaseExpiresAt },
    });

    if (recipients.length === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Campaign completed." });
    }

    for (const recipient of recipients) {
      const isSuppressed = await prisma.suppression.findUnique({
        where: { email: recipient.email },
      });

      if (isSuppressed) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SKIPPED", lastError: "Suppressed / Unsubscribed" },
        });
        continue;
      }

      const mergeValues = {
        email: recipient.email,
        FirstName: (recipient as any).firstName || "",
        LastName: (recipient as any).lastName || "",
        Company: (recipient as any).company || "",
        ...( (recipient as any).customFields || {}),
      };

      const subject = interpolateText(campaign.subject, mergeValues);
      const html = interpolateHtml(campaign.htmlContent, mergeValues);

      const result = await sendEmailViaProvider({
        to: recipient.email,
        subject,
        html,
        idempotencyKey: `camp:${campaignId}:rec:${recipient.id}`,
        sendingAccount: sendingAccount ? { provider: sendingAccount.provider, credentials: sendingAccount.credentials } : undefined,
      });

      if (result.success) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", sentAt: new Date(), leaseExpiresAt: null },
        });
      } else {
        const isPermanent = result.errorCategory === "PERMANENT" || result.errorCategory === "AUTH_ERROR";
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: isPermanent ? "FAILED" : "PENDING", 
            lastError: result.error,
            leaseExpiresAt: null
          },
        });
      }
    }

    const remainingCount = await prisma.campaignRecipient.count({
      where: { campaignId, status: "PENDING" },
    });

    if (remainingCount > 0) {
      const appUrl = process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
      await qstashClient.publishJSON({
        url: `${appUrl}/api/queue/send-campaign`,
        body: { campaignId, batchSize },
      });
    }

    return NextResponse.json({ success: true, processed: recipients.length });
  } catch (error) {
    console.error("Queue worker execution failed:", error);
    return NextResponse.json({ error: "Worker processing failed." }, { status: 500 });
  }
}
