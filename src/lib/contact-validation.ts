const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_CONTACTS_PER_REQUEST = 200;
export const MAX_CUSTOM_FIELDS = 50;
export const MAX_FIELD_LENGTH = 200;
export const MAX_CUSTOM_FIELD_VALUE_LENGTH = 2000;
export const MAX_CONTACT_EMAIL_LENGTH = 320;

export type ContactInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  customFields?: Record<string, unknown>;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.length <= MAX_CONTACT_EMAIL_LENGTH &&
    EMAIL_REGEX.test(email.trim())
  );
}

export function validateOptionalString(
  value: unknown,
  maxLength = MAX_FIELD_LENGTH,
): value is string | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= maxLength)
  );
}

export function validateCustomFields(
  value: unknown,
): value is Record<string, unknown> {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const fields = value as Record<string, unknown>;
  const entries = Object.entries(fields);

  if (entries.length > MAX_CUSTOM_FIELDS) {
    return false;
  }

  for (const [key, fieldValue] of entries) {
    if (
      !key.trim() ||
      key.length > MAX_FIELD_LENGTH ||
      key.startsWith("$") ||
      key.includes(".")
    ) {
      return false;
    }

    if (
      typeof fieldValue === "string" &&
      fieldValue.length > MAX_CUSTOM_FIELD_VALUE_LENGTH
    ) {
      return false;
    }

    if (
      fieldValue !== null &&
      typeof fieldValue !== "string" &&
      typeof fieldValue !== "number" &&
      typeof fieldValue !== "boolean"
    ) {
      return false;
    }

    if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
      return false;
    }
  }

  return true;
}
