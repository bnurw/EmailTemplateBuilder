"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ImportColumn,
  StandardField,
  inferColumnMappings,
  isValidEmail,
  normalizeEmail,
} from "../lib/import-utils";

type Props = {
  contactListId: string;
  onImportComplete?: () => void;
};

type ParsedRow = Record<string, string>;
type ImportResult = { created: number; skippedExisting: number };

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 10000;
const BATCH_SIZE = 200;

const STANDARD_FIELDS: { value: StandardField; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "company", label: "Company" },
  { value: "custom", label: "Custom field" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(result: unknown, fallback: string): string {
  if (isRecord(result) && typeof result.error === "string") {
    return result.error;
  }
  return fallback;
}

export default function ContactImporter({ contactListId, onImportComplete }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mappings, setMappings] = useState<ImportColumn[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = useMemo(
    () =>
      rows.filter((row) => {
        const emailColumn = mappings.find((m) => m.targetField === "email");
        return emailColumn && isValidEmail(row[emailColumn.sourceHeader]);
      }),
    [rows, mappings],
  );

  const invalidCount = rows.length - validRows.length;

  const updateMapping = (index: number, targetField: StandardField) => {
    setMappings((current) =>
      current.map((mapping, i) =>
        i === index
          ? {
              ...mapping,
              targetField,
              customFieldKey: targetField === "custom" ? mapping.customFieldKey || mapping.sourceHeader : undefined,
            }
          : mapping,
      ),
    );
  };

  const parseFile = async (file: File) => {
    setError(null);
    setResult(null);

    if (file.size > MAX_FILE_SIZE) {
      setError("File must be 10 MB or smaller.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx"].includes(extension)) {
      setError("Upload a CSV or XLSX file.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false, dense: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("The workbook contains no worksheets.");

      const sheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });

      if (matrix.length < 2) {
        throw new Error("The file must contain a header row and at least one data row.");
      }

      const rawHeaders = (matrix[0] as unknown[]).map((v) => String(v ?? "").trim());
      if (rawHeaders.some((h) => h.length > 200)) {
        throw new Error("Column headers cannot exceed 200 characters.");
      }

      const uniqueHeaders: string[] = [];
      const seen = new Map<string, number>();

      rawHeaders.forEach((header, index) => {
        const base = header || `Column ${index + 1}`;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        uniqueHeaders.push(count === 0 ? base : `${base} (${count + 1})`);
      });

      const dataRows = matrix.slice(1);
      if (dataRows.length > MAX_IMPORT_ROWS) {
        throw new Error(`Maximum ${MAX_IMPORT_ROWS} rows per import file.`);
      }

      const parsedRows = dataRows.map((rawRow: any) => {
        const row: ParsedRow = {};
        uniqueHeaders.forEach((header, index) => {
          row[header] = String(rawRow[index] ?? "").trim();
        });
        return row;
      });

      setHeaders(uniqueHeaders);
      setRows(parsedRows);
      setMappings(inferColumnMappings(uniqueHeaders));
      setFileName(file.name);
      setProgress(0);
    } catch (caught) {
      setHeaders([]);
      setRows([]);
      setMappings([]);
      setError(caught instanceof Error ? caught.message : "Unable to parse the file.");
    }
  };

  const startImport = async () => {
    setError(null);
    setResult(null);

    const emailMapping = mappings.find((m) => m.targetField === "email");
    if (!emailMapping) {
      setError("Map one column to Email.");
      return;
    }

    if (validRows.length === 0) {
      setError("There are no valid email addresses to import.");
      return;
    }

    setLoading(true);
    let created = 0;
    let skippedExisting = 0;

    try {
      const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
      const columnDefinitions = mappings
        .filter((m) => m.targetField === "custom")
        .map((m) => ({
          key: m.customFieldKey || m.sourceHeader,
          label: m.sourceHeader,
          type: "text" as const,
        }));

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = validRows.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
        const contacts = batch.map((row) => {
          const contact: {
            email: string;
            firstName: string | null;
            lastName: string | null;
            company: string | null;
            customFields: Record<string, string>;
          } = {
            email: "",
            firstName: null,
            lastName: null,
            company: null,
            customFields: {},
          };

          for (const mapping of mappings) {
            const value = row[mapping.sourceHeader] ?? "";
            if (mapping.targetField === "email") {
              contact.email = normalizeEmail(value);
            } else if (mapping.targetField === "firstName") {
              contact.firstName = value || null;
            } else if (mapping.targetField === "lastName") {
              contact.lastName = value || null;
            } else if (mapping.targetField === "company") {
              contact.company = value || null;
            } else {
              const key = mapping.customFieldKey || mapping.sourceHeader;
              contact.customFields[key] = value;
            }
          }
          return contact;
        });

        const response = await fetch(`/api/contact-lists/${encodeURIComponent(contactListId)}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts, columnDefinitions }),
        });

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }

        if (!response.ok || !isRecord(payload)) {
          throw new Error(getErrorMessage(payload, `Import failed on batch ${batchIndex + 1}.`));
        }

        created += Number(payload.created ?? 0);
        skippedExisting += Number(payload.skippedExisting ?? 0);
        setProgress(Math.round(((batchIndex + 1) / totalBatches) * 100));
      }

      setResult({ created, skippedExisting });
      onImportComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <header>
        <h2 className="text-xl font-semibold text-gray-900">Import contacts</h2>
        <p className="mt-1 text-sm text-gray-500">Upload CSV or Excel files and map their columns to contact fields.</p>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-blue-400">
        <span className="font-medium text-gray-800">Choose a CSV or XLSX file</span>
        <span className="mt-2 text-sm text-gray-500">Maximum 10 MB and 10,000 data rows</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          className="sr-only"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void parseFile(file);
            e.currentTarget.value = "";
          }}
        />
      </label>

      {fileName && <p className="text-sm text-gray-600">Selected file: <strong>{fileName}</strong></p>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {headers.length > 0 && (
        <>
          <div>
            <h3 className="font-medium text-gray-900">Map columns</h3>
            <p className="mt-1 text-sm text-gray-500">Standard fields are detected automatically. Unmapped columns become custom merge variables.</p>
          </div>

          <div className="space-y-3">
            {mappings.map((mapping, index) => (
              <div key={`${mapping.sourceHeader}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">Spreadsheet column</p>
                  <p className="font-medium">{mapping.sourceHeader}</p>
                </div>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">Import as</span>
                  <select
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(index, e.target.value as StandardField)}
                    disabled={loading}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    {STANDARD_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="whitespace-nowrap border-b px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b">
                    {headers.map((h) => (
                      <td key={h} className="whitespace-nowrap px-3 py-2">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-gray-600">
            <p>Total rows: {rows.length}</p>
            <p>Rows with valid emails: {validRows.length}</p>
            <p>Rows with invalid or missing emails: {invalidCount}</p>
          </div>

          {loading && (
            <div role="status" aria-live="polite" className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600">Importing contacts: {progress}%</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void startImport()}
            disabled={loading || validRows.length === 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Importing..." : `Import ${validRows.length} contacts`}
          </button>
        </>
      )}

      {result && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">Import finished</p>
          <p>Contacts created: {result.created}</p>
          <p>Existing contacts skipped: {result.skippedExisting}</p>
          <p>Invalid rows excluded: {invalidCount}</p>
        </div>
      )}
    </section>
  );
}
