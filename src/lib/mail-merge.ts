export type MergeValues = Record<string, unknown>;
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_. -]+?)\s*\}\}/g;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveVariable(values: MergeValues, key: string): string | null {
  const normalizedKey = key.trim();
  if (Object.prototype.hasOwnProperty.call(values, normalizedKey)) {
    const value = values[normalizedKey];
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return null;
}

export function interpolateText(template: string, values: MergeValues): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => resolveVariable(values, key) ?? match);
}

export function interpolateHtml(template: string, values: MergeValues): string {
  return template.replace(VARIABLE_PATTERN, (match, key: string) => {
    const value = resolveVariable(values, key);
    return value === null ? match : escapeHtml(value);
  });
}

export function listMergeVariables(template: string): string[] {
  const variables = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    variables.add(match[1].trim());
  }
  return Array.from(variables);
}
