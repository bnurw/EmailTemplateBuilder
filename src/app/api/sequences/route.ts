import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  try {
    const sequences = await prisma.sequence.findMany({
      where: { userId },
    });

    return NextResponse.json({ items: sequences });
  } catch (error) {
    console.error("Failed to fetch sequences:", error);
    return NextResponse.json({ error: "Unable to load sequences." }, { status: 500 });
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
  const stages = Array.isArray(body.stages) ? body.stages : [];

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Sequence name is required (max 120 chars)." }, { status: 400 });
  }

  try {
    const sequence = await prisma.sequence.create({
      data: {
        userId,
        name,
        status: "DRAFT",
        stages: stages.map((s: any, idx: number) => ({
          stepNumber: idx + 1,
          delayDays: Number(s.delayDays || 1),
          subject: String(s.subject || "Follow-up"),
          htmlContent: String(s.htmlContent || "<p>Hello</p>"),
        })),
      },
    });

    return NextResponse.json({ success: true, item: sequence }, { status: 201 });
  } catch (error) {
    console.error("Failed to create sequence:", error);
    return NextResponse.json({ error: "Unable to create sequence." }, { status: 500 });
  }
}
