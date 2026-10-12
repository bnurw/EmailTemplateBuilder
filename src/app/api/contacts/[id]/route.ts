import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { normalizeEmail, validateCustomFields, validateEmail, validateOptionalString } from "@/lib/contact-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if ("email" in input) {
    if (!validateEmail(input.email)) return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    data.email = normalizeEmail(input.email);
  }

  for (const field of ["firstName", "lastName", "company"] as const) {
    if (field in input) {
      if (!validateOptionalString(input[field])) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      data[field] = input[field] ?? null;
    }
  }

  if ("customFields" in input) {
    if (!validateCustomFields(input.customFields)) return NextResponse.json({ error: "Invalid custom fields." }, { status: 400 });
    data.customFields = input.customFields ?? {};
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields were supplied." }, { status: 400 });

  try {
    const existing = await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    const updated = await prisma.contact.update({ where: { id }, data });
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json({ error: "Unable to update contact." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id } = await context.params;
  try {
    const existing = await prisma.contact.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("Failed to delete contact:", error);
    return NextResponse.json({ error: "Unable to delete contact. It may be referenced by an existing campaign." }, { status: 409 });
  }
}
