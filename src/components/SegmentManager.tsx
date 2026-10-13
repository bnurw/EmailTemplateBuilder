"use client";

import { useEffect, useState } from "react";
import { Users, Tag, Plus, Trash2, Filter, Layers, RefreshCcw, CheckCircle2 } from "lucide-react";

type TagItem = {
  id: string;
  name: string;
};

type SegmentItem = {
  id: string;
  name: string;
  rules: any;
  createdAt: string;
};

export default function SegmentManager() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTagName, setNewTagName] = useState("");
  const [newSegName, setNewSegName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [creatingSeg, setCreatingSeg] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tagsRes, segsRes] = await Promise.all([
        fetch("/api/tags", { cache: "no-store" }),
        fetch("/api/segments", { cache: "no-store" }),
      ]);
      const tagsData = await tagsRes.json();
      const segsData = await segsRes.json();
      if (!tagsRes.ok || !segsRes.ok) throw new Error("Failed to load tags or segments.");
      setTags(tagsData.items || []);
      setSegments(segsData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load segmentation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setCreatingTag(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create tag.");
      setNewTagName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag creation failed.");
    } finally {
      setCreatingTag(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      const res = await fetch(`/api/tags?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tag.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tag deletion failed.");
    }
  };

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegName.trim()) return;
    setCreatingSeg(true);
    setError(null);
    try {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSegName.trim(),
          rules: { op: "AND", conditions: [] },
        }),
      });
      if (!res.ok) throw new Error("Failed to create segment.");
      setNewSegName("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segment creation failed.");
    } finally {
      setCreatingSeg(false);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    try {
      const res = await fetch(`/api/segments/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete segment.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Segment deletion failed.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 bg-white border rounded-2xl">Loading audience segments & tags...</div>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void loadData()} className="p-1 hover:bg-red-100 rounded">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tags Section */}
      <div className="bg-white border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" />
              Contact Tags
            </h3>
            <p className="text-xs text-gray-500">Organize and categorize contacts with custom tags</p>
          </div>
          <form onSubmit={handleCreateTag} className="flex items-center gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name..."
              className="rounded-xl border px-3 py-2 text-sm"
              maxLength={50}
            />
            <button
              type="submit"
              disabled={creatingTag}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Tag
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-sm text-indigo-800">
              <span className="font-medium">{tag.name}</span>
              <button
                type="button"
                onClick={() => void handleDeleteTag(tag.id)}
                className="text-indigo-400 hover:text-red-600 transition-colors"
                title="Delete tag"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-sm text-gray-400">No contact tags created yet.</p>}
        </div>
      </div>

      {/* Saved Segments Section */}
      <div className="bg-white border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Saved Audience Segments
            </h3>
            <p className="text-xs text-gray-500">Reusable dynamic filters for targeted email campaigns</p>
          </div>
          <form onSubmit={handleCreateSegment} className="flex items-center gap-2">
            <input
              type="text"
              value={newSegName}
              onChange={(e) => setNewSegName(e.target.value)}
              placeholder="Segment name..."
              className="rounded-xl border px-3 py-2 text-sm"
              maxLength={120}
            />
            <button
              type="submit"
              disabled={creatingSeg}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Create Segment
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-2">
          {segments.map((seg) => (
            <div key={seg.id} className="border rounded-xl p-4 flex items-center justify-between gap-4 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{seg.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Dynamic rules engine active • Matches contacts in real-time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleDeleteSegment(seg.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete segment"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {segments.length === 0 && <p className="text-sm text-gray-400">No saved segments found.</p>}
        </div>
      </div>
    </div>
  );
}
