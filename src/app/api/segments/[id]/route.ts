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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id } = await context.params;

  try {
    const segment = await prisma.segment.findFirst({ where: { id, userId } });
    if (!segment) {
      return NextResponse.json({ error: "Segment not found or unauthorized." }, { status: 404 });
    }

    const contacts = await prisma.contact.findMany({ where: { userId } });
    // Evaluate matching contacts based on rules
    const matching = contacts.filter(() => true); // dynamic evaluation mock

    return NextResponse.json({
      item: segment,
      matchingCount: matching.length,
      contacts: matching.slice(0, 50),
    });
  } catch (error) {
    console.error("Failed to fetch segment details:", error);
    return NextResponse.json({ error: "Unable to load segment details." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id } = await context.params;

  try {
    const segment = await prisma.segment.findFirst({ where: { id, userId } });
    if (!segment) {
      return NextResponse.json({ error: "Segment not found or unauthorized." }, { status: 404 });
    }

    await prisma.segment.delete({ where: { id } });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete segment:", error);
    return NextResponse.json({ error: "Unable to delete segment." }, { status: 500 });
  }
}
