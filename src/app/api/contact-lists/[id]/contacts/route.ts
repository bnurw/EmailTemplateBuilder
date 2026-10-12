import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import {
  MAX_CONTACTS_PER_REQUEST,
  normalizeEmail,
  validateCustomFields,
  validateEmail,
  validateOptionalString,
} from "@/lib/contact-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id: listId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "25") || 25));
  const search = searchParams.get("search")?.trim();

  try {
    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId },
      select: { id: true, name: true, columnDefinitions: true },
    });

    if (!list) return NextResponse.json({ error: "Contact list not found." }, { status: 404 });

    const where = {
      userId,
      contactListId: listId,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { company: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      list,
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Failed to fetch contacts:", error);
    return NextResponse.json({ error: "Unable to load contacts." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id: listId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!input) return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });

  const rawContacts = Array.isArray(input.contacts) ? input.contacts : [input];
  if (rawContacts.length === 0 || rawContacts.length > MAX_CONTACTS_PER_REQUEST) {
    return NextResponse.json({ error: `Submit between 1 and ${MAX_CONTACTS_PER_REQUEST} contacts per request.` }, { status: 400 });
  }

  const normalizedContacts = [];
  for (let index = 0; index < rawContacts.length; index++) {
    const raw = rawContacts[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: `Invalid contact at row ${index + 1}.` }, { status: 400 });
    }
    const contact = raw as Record<string, unknown>;
    if (!validateEmail(contact.email)) {
      return NextResponse.json({ error: `Invalid email at row ${index + 1}.` }, { status: 400 });
    }
    if (
      !validateOptionalString(contact.firstName) ||
      !validateOptionalString(contact.lastName) ||
      !validateOptionalString(contact.company) ||
      !validateCustomFields(contact.customFields)
    ) {
      return NextResponse.json({ error: `Invalid fields at row ${index + 1}.` }, { status: 400 });
    }
    normalizedContacts.push({
      email: normalizeEmail(contact.email),
      firstName: contact.firstName ?? null,
      lastName: contact.lastName ?? null,
      company: contact.company ?? null,
      customFields: contact.customFields && typeof contact.customFields === "object" ? contact.customFields : {},
    });
  }

  const emails = normalizedContacts.map((c) => c.email);
  if (new Set(emails).size !== emails.length) {
    return NextResponse.json({ error: "The request contains duplicate email addresses." }, { status: 400 });
  }

  try {
    const list = await prisma.contactList.findFirst({ where: { id: listId, userId }, select: { id: true } });
    if (!list) return NextResponse.json({ error: "Contact list not found." }, { status: 404 });

    const created = await prisma.$transaction(
      normalizedContacts.map((contact) => prisma.contact.create({ data: { userId, contactListId: listId, ...contact } })),
    );

    return NextResponse.json({ items: created, createdCount: created.length }, { status: 201 });
  } catch (error) {
    console.error("Failed to create contacts:", error);
    return NextResponse.json({ error: "Unable to create contacts." }, { status: 500 });
  }
}
