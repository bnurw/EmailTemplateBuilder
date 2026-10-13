import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  try {
    // Token can decode or map to email or recipient ID
    const email = token.includes("@") ? token : "recipient@example.com";
    await prisma.suppression.create({
      data: { email, reason: "UNSUBSCRIBED" },
    });

    return new NextResponse(
      `<!doctype html>
      <html lang="en">
        <head><title>Unsubscribed</title><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script></head>
        <body class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div class="max-w-md w-full bg-white rounded-2xl border p-8 shadow-sm text-center">
            <h1 class="text-xl font-bold text-gray-900 mb-2">You have been unsubscribed</h1>
            <p class="text-sm text-gray-600">Your email address (${email}) has been successfully removed from this mailing list.</p>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return NextResponse.json({ error: "Unable to process unsubscribe request." }, { status: 500 });
  }
}
