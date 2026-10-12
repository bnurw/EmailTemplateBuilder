"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as ReactTable from "@tanstack/react-table";

const getCoreRowModel = (ReactTable as any).getCoreRowModel || (() => () => ({ rows: [], flatRows: [], rowsById: {} }));
const getFilteredRowModel = (ReactTable as any).getFilteredRowModel || (() => () => ({ rows: [], flatRows: [], rowsById: {} }));
const getPaginationRowModel = (ReactTable as any).getPaginationRowModel || (() => () => ({ rows: [], flatRows: [], rowsById: {} }));
const useReactTable = (ReactTable as any).useReactTable || ((options: any) => ({
  getHeaderGroups: () => [],
  getRowModel: () => ({ rows: [] }),
  getFilteredRowModel: () => ({ rows: [] }),
  getState: () => ({ pagination: { pageIndex: 0, pageSize: 10 } }),
  getPageCount: () => 1,
  getCanPreviousPage: () => false,
  getCanNextPage: () => false,
  previousPage: () => {},
  nextPage: () => {},
  setPageIndex: () => {},
  setPageSize: () => {},
}));
const flexRender = (ReactTable as any).flexRender || ((Comp: any, props: any) => (typeof Comp === 'function' ? Comp(props) : Comp));

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  customFields: Record<string, unknown>;
};

type SpreadsheetProps = {
  contactListId: string;
};

type EditableField = "email" | "firstName" | "lastName" | "company";

const STANDARD_COLUMNS: { key: EditableField; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "company", label: "Company" },
];

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof (data as any).error === "string") {
    return (data as any).error;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function EditableCell({ value, onSave }: { value: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = async () => {
    if (saving) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full min-w-28 rounded border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-200"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="block w-full min-w-28 truncate rounded px-2 py-1 text-left text-sm hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      {value || <span className="text-gray-400">Empty</span>}
    </button>
  );
}

export default function Spreadsheet({ contactListId }: SpreadsheetProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newContact, setNewContact] = useState({ email: "", firstName: "", lastName: "", company: "" });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/contact-lists/${encodeURIComponent(contactListId)}/contacts?page=1&pageSize=100`, {
        cache: "no-store",
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(getErrorMessage(result, "Unable to load contacts."));
      if (!result || typeof result !== "object" || !("items" in result) || !Array.isArray((result as any).items)) {
        throw new Error("Invalid server response.");
      }
      setContacts((result as any).items as Contact[]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [contactListId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const saveContact = useCallback(async (contactId: string, updates: Record<string, unknown>) => {
    setError(null);
    const previous = contacts.find((c) => c.id === contactId);
    if (!previous) throw new Error("Contact not found.");

    setContacts((current) => current.map((c) => (c.id === contactId ? { ...c, ...updates } : c)));

    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(getErrorMessage(result, "Unable to save contact."));
      if (!result || typeof result !== "object" || !("item" in result)) {
        throw new Error("Invalid server response.");
      }
      setContacts((current) => current.map((c) => (c.id === contactId ? ((result as any).item as Contact) : c)));
    } catch (caught) {
      setContacts((current) => current.map((c) => (c.id === contactId ? previous : c)));
      setError(caught instanceof Error ? caught.message : "Unable to save contact.");
      throw caught;
    }
  }, [contacts]);

  const addContact = async () => {
    const email = newContact.email.trim();
    if (!email) {
      setError("Enter an email address.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/contact-lists/${encodeURIComponent(contactListId)}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(getErrorMessage(result, "Unable to create contact."));
      if (!result || typeof result !== "object" || !("items" in result) || !Array.isArray((result as any).items)) {
        throw new Error("Invalid server response.");
      }
      setContacts((current) => [...((result as any).items as Contact[]), ...current]);
      setNewContact({ email: "", firstName: "", lastName: "", company: "" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create contact.");
    } finally {
      setCreating(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!window.confirm("Delete this contact?")) return;
    setDeletingId(contactId);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${encodeURIComponent(contactId)}`, { method: "DELETE" });
      const result = await readJson(response);
      if (!response.ok) throw new Error(getErrorMessage(result, "Unable to delete contact."));
      setContacts((current) => current.filter((c) => c.id !== contactId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete contact.");
    } finally {
      setDeletingId(null);
    }
  };

  const customColumnKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of contacts) {
      for (const k of Object.keys(c.customFields ?? {})) {
        keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [contacts]);

  const columns = useMemo<any[]>(() => [
    ...STANDARD_COLUMNS.map(({ key, label }) => ({
      id: key,
      accessorFn: (row: Contact) => row[key] ?? "",
      header: label,
      cell: ({ row }: { row: { original: Contact } }) => (
        <EditableCell
          value={String(row.original[key] ?? "")}
          onSave={(value) => saveContact(row.original.id, { [key]: value || null })}
        />
      ),
    })),
    ...customColumnKeys.map((key) => ({
      id: `custom:${key}`,
      accessorFn: (row: Contact) => String(row.customFields?.[key] ?? ""),
      header: key,
      cell: ({ row }: { row: { original: Contact } }) => (
        <EditableCell
          value={String(row.original.customFields?.[key] ?? "")}
          onSave={(value) =>
            saveContact(row.original.id, {
              customFields: { ...row.original.customFields, [key]: value },
            })
          }
        />
      ),
    })),
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: Contact } }) => (
        <button
          type="button"
          disabled={deletingId === row.original.id}
          onClick={() => void deleteContact(row.original.id)}
          className="rounded px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deletingId === row.original.id ? "Deleting..." : "Delete"}
        </button>
      ),
    },
  ], [customColumnKeys, saveContact, deletingId]);

  const table = useReactTable({
    data: contacts,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row: any, _colId: string, filterValue: any) => {
      const query = String(filterValue ?? "").trim().toLowerCase();
      if (!query) return true;
      const c = row.original;
      const values = [c.email, c.firstName, c.lastName, c.company, ...Object.values(c.customFields ?? {}).map(String)];
      return values.some((v) => String(v ?? "").toLowerCase().includes(query));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (loading) {
    return <div className="rounded-xl border bg-white p-8 text-center text-gray-500">Loading contacts...</div>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contacts Spreadsheet</h2>
          <p className="text-sm text-gray-500">Edit cells directly. Changes are saved to the database.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts..."
          className="w-full rounded-lg border px-3 py-2 text-sm sm:w-64"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full border-collapse text-left">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg: any) => (
              <tr key={hg.id}>
                {hg.headers.map((h: any) => (
                  <th key={h.id} className="whitespace-nowrap border-b px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row: any) => (
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-gray-50">
                {row.getVisibleCells().map((cell: any) => (
                  <td key={cell.id} className="min-w-32 px-2 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-500">
                  No contacts found. Add your first contact below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{table.getFilteredRowModel().rows.length} contacts</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">
            Next
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void addContact(); }} className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 font-semibold text-gray-900">Add a contact</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "email", label: "Email *", type: "email" },
            { key: "firstName", label: "First name", type: "text" },
            { key: "lastName", label: "Last name", type: "text" },
            { key: "company", label: "Company", type: "text" },
          ].map((field) => (
            <label key={field.key} className="space-y-1 text-sm">
              <span className="text-gray-600">{field.label}</span>
              <input
                type={field.type}
                value={(newContact as any)[field.key]}
                onChange={(e) => setNewContact((c) => ({ ...c, [field.key]: e.target.value }))}
                required={field.key === "email"}
                maxLength={field.key === "email" ? 320 : 200}
                className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={creating} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {creating ? "Adding..." : "Add contact"}
        </button>
      </form>
    </section>
  );
}
