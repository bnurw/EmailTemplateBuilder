"use client";

import { useEffect, useState } from "react";
import { GitBranch, Play, Pause, Plus, CheckCircle2, Clock, Mail, AlertCircle, RefreshCcw } from "lucide-react";

type Sequence = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export default function SequenceDashboard() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadSequences = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sequences", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load sequences.");
      setSequences(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequences.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSequences();
  }, []);

  const createSequence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          stages: [
            { stepNumber: 1, delayDays: 1, subject: "Initial Follow-up", htmlContent: "<p>Hi {{FirstName}}, checking in.</p>" },
            { stepNumber: 2, delayDays: 3, subject: "Second Follow-up", htmlContent: "<p>Hi {{FirstName}}, following up on my previous note.</p>" },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create sequence.");
      setNewName("");
      await loadSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/sequences/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status.");
      await loadSequences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 bg-white border rounded-2xl">Loading automated sequences...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Automated Follow-Up Sequences</h3>
          <p className="text-xs text-gray-500">Multi-step drip campaigns and automated workflow execution</p>
        </div>
        <form onSubmit={createSequence} className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New sequence name..."
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => void loadSequences()} className="p-1 hover:bg-red-100 rounded">
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {sequences.map((seq) => (
          <div key={seq.id} className="bg-white border rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                <GitBranch className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-900 text-base">{seq.name}</h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    seq.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                    seq.status === 'PAUSED' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {seq.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">2 Email Steps • Automated Delay Drip • QStash Queue Enabled</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleStatus(seq.id, seq.status)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  seq.status === 'ACTIVE'
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {seq.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {seq.status === 'ACTIVE' ? 'Pause Sequence' : 'Activate Sequence'}
              </button>
            </div>
          </div>
        ))}
        {sequences.length === 0 && (
          <div className="p-12 text-center bg-white border rounded-2xl text-gray-500 text-sm">
            No follow-up sequences found. Create your first sequence above.
          </div>
        )}
      </div>
    </div>
  );
}
