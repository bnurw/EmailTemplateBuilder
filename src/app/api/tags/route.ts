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
    const tags = await prisma.tag.findMany({ where: { userId } });
    return NextResponse.json({ items: tags });
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json({ error: "Unable to load tags." }, { status: 500 });
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
  if (!name || name.length > 50) {
    return NextResponse.json({ error: "Tag name is required (max 50 chars)." }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.create({
      data: { userId, name },
    });
    return NextResponse.json({ success: true, item: tag }, { status: 201 });
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json({ error: "Unable to create tag." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Tag ID is required." }, { status: 400 });
  }

  try {
    await prisma.tag.delete({ where: { id, userId } });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json({ error: "Unable to delete tag." }, { status: 500 });
  }
}
