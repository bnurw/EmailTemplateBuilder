import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const urlParam = request.nextUrl.searchParams.get("url");

  let destination = "https://example.com";
  if (urlParam) {
    try {
      const decoded = decodeURIComponent(urlParam);
      const parsed = new URL(decoded);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        destination = parsed.toString();
      }
    } catch {
      // fallback to default destination if invalid URL
    }
  }

  try {
    const campaignId = token.split("_")[0] || "camp-1";
    await prisma.clickEvent.create({
      data: { campaignId, url: destination },
    });
  } catch (error) {
    console.error("Click tracking failed:", error);
  }

  return NextResponse.redirect(destination, { status: 302 });
}
