export type StandardField =
  | "email"
  | "firstName"
  | "lastName"
  | "company"
  | "custom";

export type ImportColumn = {
  sourceHeader: string;
  targetField: StandardField;
  customFieldKey?: string;
};

const HEADER_ALIASES: Record<
  Exclude<StandardField, "custom">,
  string[]
> = {
  email: [
    "email",
    "email address",
    "e-mail",
    "e-mail address",
    "emailaddress",
    "mail",
  ],
  firstName: [
    "first name",
    "firstname",
    "first_name",
    "given name",
    "givenname",
  ],
  lastName: [
    "last name",
    "lastname",
    "last_name",
    "surname",
    "family name",
  ],
  company: [
    "company",
    "company name",
    "organization",
    "organisation",
    "business",
  ],
};

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function inferTargetField(
  header: string,
): StandardField {
  const normalized = normalizeHeader(header);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) {
      return field as StandardField;
    }
  }

  return "custom";
}

export function inferColumnMappings(
  headers: string[],
): ImportColumn[] {
  return headers.map((sourceHeader) => {
    const targetField = inferTargetField(sourceHeader);

    return {
      sourceHeader,
      targetField,
      ...(targetField === "custom"
        ? { customFieldKey: sourceHeader.trim() }
        : {}),
    };
  });
}

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const email = value.trim();

  if (email.length === 0 || email.length > 320) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
