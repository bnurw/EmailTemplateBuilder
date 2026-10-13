import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(_request: NextRequest) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  try {
    const segments = await prisma.segment.findMany({ where: { userId } });
    return NextResponse.json({ items: segments });
  } catch (error) {
    console.error("Failed to fetch segments:", error);
    return NextResponse.json({ error: "Unable to load segments." }, { status: 500 });
  }
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
  const rules = isRecord(body.rules) ? body.rules : {};

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Segment name is required (max 120 chars)." }, { status: 400 });
  }

  try {
    const segment = await prisma.segment.create({
      data: { userId, name, rules },
    });
    return NextResponse.json({ success: true, item: segment }, { status: 201 });
  } catch (error) {
    console.error("Failed to create segment:", error);
    return NextResponse.json({ error: "Unable to create segment." }, { status: 500 });
  }
}
