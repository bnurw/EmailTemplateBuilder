"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  interpolateHtml,
  interpolateText,
  listMergeVariables,
  type MergeValues,
} from "../lib/mail-merge";

type Props = {
  availableVariables: string[];
  previewRecipients: MergeValues[];
  sendingAccountId?: string;
};

type PreviewRecipient = {
  label: string;
  values: MergeValues;
};

function getErrorMessage(result: unknown, fallback: string): string {
  if (typeof result === "object" && result !== null && "error" in result && typeof (result as any).error === "string") {
    return (result as any).error;
  }
  return fallback;
}

export default function EmailTemplateBuilder({ availableVariables, previewRecipients, sendingAccountId }: Props) {
  const [name, setName] = useState("New Campaign");
  const [subject, setSubject] = useState("Hello {{FirstName}}");
  const [htmlContent, setHtmlContent] = useState("<p>Hello {{FirstName}},</p><p>We have an offer for {{Company}}.</p>");

  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto"] }),
      Placeholder.configure({ placeholder: "Write your email here..." }),
    ],
    content: htmlContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const nextHtml = editor.getHTML();
      setHtmlContent(nextHtml);
      setShowSuggestions(editor.getText().endsWith("{{"));
    },
  });

  const currentRecipient: PreviewRecipient = useMemo(() => {
    const values = previewRecipients[previewIndex] ?? {};
    const label = String(values.FirstName ?? values.email ?? "Recipient");
    return { label, values };
  }, [previewRecipients, previewIndex]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!previewMode);
  }, [editor, previewMode]);

  const currentSuggestions = availableVariables.filter((variable) =>
    variable.toLowerCase().includes(editor?.getText().split("{{").pop()?.toLowerCase() ?? ""),
  );

  const insertVariable = (variable: string) => {
    if (!editor) return;
    const text = editor.getText();
    if (text.endsWith("{{")) {
      const position = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from: Math.max(1, position - 2), to: position })
        .insertContent(`{{${variable}}}`)
        .run();
    } else {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
    setShowSuggestions(false);
  };

  const previewHtml = useMemo(() => interpolateHtml(htmlContent, currentRecipient.values), [htmlContent, currentRecipient]);
  const previewSubject = useMemo(() => interpolateText(subject, currentRecipient.values), [subject, currentRecipient]);

  const usedVariables = useMemo(
    () => Array.from(new Set([...listMergeVariables(subject), ...listMergeVariables(htmlContent)])),
    [subject, htmlContent],
  );

  const missingVariables = usedVariables.filter(
    (variable) => !Object.prototype.hasOwnProperty.call(currentRecipient.values, variable),
  );

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const plainText = editor?.getText() ?? "";
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlContent,
          textContent: plainText,
          sendingAccountId,
        }),
      });

      let result: unknown;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(result, "Unable to save campaign draft."));
      }

      if (typeof result !== "object" || result === null || !("campaign" in result)) {
        throw new Error("Invalid server response.");
      }

      const campaign = (result as any).campaign;
      if (typeof campaign !== "object" || campaign === null || !("id" in campaign) || typeof campaign.id !== "string") {
        throw new Error("Campaign ID missing from response.");
      }

      setSavedCampaignId(campaign.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save campaign draft.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
      <header>
        <h2 className="text-xl font-semibold text-gray-900">Email Template Builder</h2>
        <p className="mt-1 text-sm text-gray-500">Create personalized emails using your contact fields.</p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Campaign name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full rounded-lg border px-3 py-2" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Email subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={998} className="w-full rounded-lg border px-3 py-2" />
      </label>

      <div>
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!editor || previewMode} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Bold</button>
          <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor || previewMode} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Italic</button>
          <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor || previewMode} className="rounded border px-3 py-2 text-sm disabled:opacity-40">Bullet list</button>
          <button type="button" onClick={() => setPreviewMode((v) => !v)} className="rounded border px-3 py-2 text-sm">{previewMode ? "Edit email" : "Preview email"}</button>
        </div>

        <div className="relative min-h-64 rounded-xl border">
          {!previewMode ? (
            <>
              <EditorContent editor={editor} className="email-editor min-h-64 p-4" />
              {showSuggestions && currentSuggestions.length > 0 && (
                <div className="absolute left-4 top-16 z-10 max-h-48 overflow-auto rounded-lg border bg-white shadow-lg">
                  {currentSuggestions.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertVariable(variable)}
                      className="block w-full px-4 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      {`{{${variable}}}`}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-4">
              <h3 className="mb-4 font-semibold">{previewSubject}</h3>
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-gray-900">Insert a variable</h3>
        <div className="flex flex-wrap gap-2">
          {availableVariables.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => insertVariable(variable)}
              disabled={!editor || previewMode}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-100 disabled:opacity-40"
            >
              {`{{${variable}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-gray-50 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Preview recipient</span>
          <select value={previewIndex} onChange={(e) => setPreviewIndex(Number(e.target.value))} className="w-full rounded-lg border bg-white px-3 py-2">
            {previewRecipients.map((recipient, i) => (
              <option key={i} value={i}>
                {String(recipient.FirstName ?? recipient.email ?? `Recipient ${i + 1}`)}
              </option>
            ))}
          </select>
        </label>
        {missingVariables.length > 0 && (
          <div className="mt-3 text-sm text-amber-700">Missing preview values: {missingVariables.join(", ")}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveDraft()}
          disabled={saving || !editor}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save campaign draft"}
        </button>
        {savedCampaignId && <p className="text-sm text-green-700">Draft saved. ID: {savedCampaignId}</p>}
      </div>
    </section>
  );
}
