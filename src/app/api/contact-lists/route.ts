import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "20") || 20));
  const search = searchParams.get("search")?.trim();

  try {
    const where = {
      userId,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.contactList.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { contacts: true } } },
      }),
      prisma.contactList.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch contact lists:", error);
    return NextResponse.json({ error: "Unable to load contact lists." }, { status: 500 });
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) {
    return NextResponse.json({ error: "Name must contain between 1 and 120 characters." }, { status: 400 });
  }

  const description = input.description === undefined || input.description === null ? null : input.description;
  if (description !== null && (typeof description !== "string" || description.length > 2000)) {
    return NextResponse.json({ error: "Description must be at most 2000 characters." }, { status: 400 });
  }

  try {
    const contactList = await prisma.contactList.create({
      data: { userId, name: input.name.trim(), description, columnDefinitions: [] },
    });
    return NextResponse.json({ item: contactList }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A contact list with this name already exists." }, { status: 409 });
    }
    console.error("Failed to create contact list:", error);
    return NextResponse.json({ error: "Unable to create contact list." }, { status: 500 });
  }
}
