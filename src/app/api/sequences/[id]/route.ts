import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  try {
    const existing = await prisma.sequence.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Sequence not found or unauthorized." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.status === "string" && ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"].includes(body.status.toUpperCase())) {
      data.status = body.status.toUpperCase();
    }

    const updated = await prisma.sequence.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Failed to update sequence:", error);
    return NextResponse.json({ error: "Unable to update sequence." }, { status: 500 });
  }
}
