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

type ImportContact = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  customFields: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeColumnDefinitions(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) {
    return null;
  }

  const result: Array<{ key: string; label: string; type: "text" }> = [];
  const seen = new Set<string>();

  for (const column of value) {
    if (!isRecord(column)) return null;

    const key = typeof column.key === "string" ? column.key.trim() : "";
    const label = typeof column.label === "string" ? column.label.trim() : "";

    if (
      !key ||
      !label ||
      key.length > 200 ||
      label.length > 200 ||
      key.startsWith("$") ||
      key.includes(".") ||
      seen.has(key)
    ) {
      return null;
    }

    seen.add(key);
    result.push({ key, label, type: "text" });
  }

  return result;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { userId, response } = await requireUser();
  if (response || !userId) return response;

  const { id: listId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }

  if (
    !Array.isArray(body.contacts) ||
    body.contacts.length === 0 ||
    body.contacts.length > MAX_CONTACTS_PER_REQUEST
  ) {
    return NextResponse.json(
      { error: `Submit between 1 and ${MAX_CONTACTS_PER_REQUEST} contacts.` },
      { status: 400 },
    );
  }

  const columns = sanitizeColumnDefinitions(body.columnDefinitions);
  if (!columns) {
    return NextResponse.json({ error: "Invalid column definitions." }, { status: 400 });
  }

  const contacts: ImportContact[] = [];

  for (let index = 0; index < body.contacts.length; index++) {
    const raw = body.contacts[index];
    if (!isRecord(raw)) {
      return NextResponse.json({ error: `Invalid contact at row ${index + 1}.` }, { status: 400 });
    }

    if (!validateEmail(raw.email)) {
      return NextResponse.json({ error: `Invalid email at row ${index + 1}.` }, { status: 400 });
    }

    if (
      !validateOptionalString(raw.firstName) ||
      !validateOptionalString(raw.lastName) ||
      !validateOptionalString(raw.company) ||
      !validateCustomFields(raw.customFields)
    ) {
      return NextResponse.json({ error: `Invalid fields at row ${index + 1}.` }, { status: 400 });
    }

    contacts.push({
      email: normalizeEmail(raw.email as string),
      firstName: (raw.firstName as string) ?? null,
      lastName: (raw.lastName as string) ?? null,
      company: (raw.company as string) ?? null,
      customFields: raw.customFields && isRecord(raw.customFields) ? raw.customFields : {},
    });
  }

  const emailSet = new Set<string>();
  for (const contact of contacts) {
    if (emailSet.has(contact.email)) {
      return NextResponse.json({ error: `Duplicate email in import batch: ${contact.email}` }, { status: 400 });
    }
    emailSet.add(contact.email);
  }

  try {
    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId },
      select: { id: true, columnDefinitions: true },
    });

    if (!list) {
      return NextResponse.json({ error: "Contact list not found." }, { status: 404 });
    }

    const existing = await prisma.contact.findMany({
      where: {
        userId,
        contactListId: listId,
        email: { in: contacts.map((c) => c.email) },
      },
      select: { email: true },
    });

    const existingEmails = new Set(existing.map((c: any) => c.email.toLowerCase()));
    const newContacts = contacts.filter((c) => !existingEmails.has(c.email));

    await prisma.$transaction(async (tx: any) => {
      if (newContacts.length > 0) {
        for (const c of newContacts) {
          await tx.contact.create({
            data: {
              userId,
              contactListId: listId,
              ...c,
            },
          });
        }
      }

      const oldDefinitions = Array.isArray(list.columnDefinitions) ? list.columnDefinitions : [];
      const mergedDefinitions = new Map<string, { key: string; label: string; type: "text" }>();

      for (const old of oldDefinitions) {
        if (isRecord(old) && typeof old.key === "string" && typeof old.label === "string") {
          mergedDefinitions.set(old.key, { key: old.key, label: old.label, type: "text" });
        }
      }

      for (const column of columns) {
        mergedDefinitions.set(column.key, column);
      }

      await tx.contactList.update({
        where: { id: listId },
        data: { columnDefinitions: Array.from(mergedDefinitions.values()) },
      });
    });

    return NextResponse.json(
      {
        success: true,
        received: contacts.length,
        created: newContacts.length,
        skippedExisting: contacts.length - newContacts.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Contact import failed:", error);
    return NextResponse.json({ error: "Unable to import contacts." }, { status: 500 });
  }
}
