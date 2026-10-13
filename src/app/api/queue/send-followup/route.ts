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

  const { sequenceId, recipientEmail, stepNumber, sendingAccountId } = body;
  if (!sequenceId || !recipientEmail || !stepNumber) {
    return NextResponse.json({ error: "Missing required follow-up parameters." }, { status: 400 });
  }

  try {
    const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId } });
    if (!sequence || sequence.status !== "ACTIVE") {
      return NextResponse.json({ success: true, message: "Sequence inactive or paused." });
    }

    // Check suppression immediately before sending
    const isSuppressed = await prisma.suppression.findUnique({
      where: { email: recipientEmail },
    });

    if (isSuppressed) {
      return NextResponse.json({ success: true, message: "Recipient is suppressed or unsubscribed." });
    }

    const sendingAccount = await prisma.sendingAccount.findFirst({
      where: { id: sendingAccountId || 'acc-1' },
    });

    const stages = await prisma.followUpStage.findMany({ where: { sequenceId } });
    const currentStage = stages.find((s: any) => s.stepNumber === stepNumber);

    if (!currentStage) {
      return NextResponse.json({ success: true, message: "Follow-up stage not found." });
    }

    const mergeValues = { email: recipientEmail, FirstName: "Subscriber" };
    const subject = interpolateText(currentStage.subject, mergeValues);
    const html = interpolateHtml(currentStage.htmlContent, mergeValues);

    const result = await sendEmailViaProvider({
      to: recipientEmail,
      subject,
      html,
      idempotencyKey: `seq:${sequenceId}:step:${stepNumber}:${recipientEmail}`,
      sendingAccount: sendingAccount ? { provider: sendingAccount.provider, credentials: sendingAccount.credentials } : undefined,
    });

    if (result.success) {
      // Schedule next step if available
      const nextStage = stages.find((s: any) => s.stepNumber === stepNumber + 1);
      if (nextStage) {
        const delaySeconds = Math.max(1, (nextStage.delayDays || 1) * 86400);
        const appUrl = process.env.APP_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
        await qstashClient.publishJSON({
          url: `${appUrl}/api/queue/send-followup`,
          body: { sequenceId, recipientEmail, stepNumber: nextStage.stepNumber, sendingAccountId },
          delay: delaySeconds,
        });
      }
    }

    return NextResponse.json({ success: result.success, error: result.error });
  } catch (error) {
    console.error("Follow-up execution failed:", error);
    return NextResponse.json({ error: "Follow-up execution error." }, { status: 500 });
  }
}
