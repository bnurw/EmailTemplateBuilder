import { NextRequest, NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const htmlContent = typeof body.htmlContent === "string" ? body.htmlContent : "";
  const textContent = typeof body.textContent === "string" ? body.textContent : null;
  const sendingAccountId = typeof body.sendingAccountId === "string" ? body.sendingAccountId : null;

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Campaign name is required (max 120 chars)." }, { status: 400 });
  }

  if (!subject || subject.length > 998) {
    return NextResponse.json({ error: "Subject is required (max 998 chars)." }, { status: 400 });
  }

  if (!htmlContent.trim() || htmlContent.length > 200_000) {
    return NextResponse.json({ error: "Email HTML is required (max 200 KB)." }, { status: 400 });
  }

  const sanitizedHtml = sanitizeHtml(htmlContent, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li",
      "blockquote", "h1", "h2", "h3", "h4", "a", "div", "span", "hr",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });

  try {
    if (sendingAccountId) {
      const sendingAccount = await prisma.sendingAccount.findFirst({
        where: { id: sendingAccountId, userId },
        select: { id: true },
      });
      if (!sendingAccount) {
        return NextResponse.json({ error: "Sending account not found." }, { status: 404 });
      }
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        sendingAccountId,
        name,
        subject,
        htmlContent: sanitizedHtml,
        textContent,
        status: "DRAFT",
      },
      select: { id: true, name: true, subject: true, status: true, createdAt: true },
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    console.error("Failed to save campaign:", error);
    return NextResponse.json({ error: "Unable to save campaign." }, { status: 500 });
  }
}
