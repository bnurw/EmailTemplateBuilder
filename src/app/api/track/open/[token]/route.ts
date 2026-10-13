import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

// 1x1 transparent GIF buffer
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  try {
    // Token can embed or map to campaignId
    const campaignId = token.split("_")[0] || "camp-1";
    await prisma.emailEvent.create({
      data: { campaignId, type: "OPEN", messageId: token },
    });
  } catch (error) {
    console.error("Open tracking failed:", error);
  }

  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
