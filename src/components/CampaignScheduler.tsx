"use client";

import { useState } from "react";
import { Calendar, Clock, Play, Pause, XCircle, Send, CheckCircle2, AlertCircle } from "lucide-react";

type CampaignSchedulerProps = {
  campaignId: string;
  initialStatus?: string;
  initialScheduledAt?: string | null;
  sendingAccounts: { id: string; name: string; provider: string }[];
  contactLists: { id: string; name: string }[];
};

export default function CampaignScheduler({
  campaignId,
  initialStatus = "DRAFT",
  initialScheduledAt,
  sendingAccounts,
  contactLists,
}: CampaignSchedulerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt || "");
  const [selectedAccount, setSelectedAccount] = useState(sendingAccounts[0]?.id || "");
  const [selectedList, setSelectedList] = useState(contactLists[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAction = async (action: "SCHEDULE" | "START_IMMEDIATELY" | "PAUSE" | "RESUME" | "CANCEL") => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          scheduledAt: action === "SCHEDULE" ? scheduledAt : undefined,
          sendingAccountId: selectedAccount,
          contactListId: selectedList,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");

      setStatus(data.campaign.status);
      setSuccessMsg(`Campaign status updated successfully to ${data.campaign.status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Campaign Scheduling & Dispatch</h3>
          <p className="text-xs text-gray-500">Manage automated delivery and background queue status</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
          status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' :
          status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
          status === 'PAUSED' ? 'bg-amber-100 text-amber-800' :
          status === 'COMPLETED' ? 'bg-purple-100 text-purple-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sending Account</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            disabled={status !== 'DRAFT'}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white disabled:bg-gray-50"
          >
            {sendingAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name} ({acc.provider})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Target Contact List</label>
          <select
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            disabled={status !== 'DRAFT'}
            className="w-full rounded-xl border px-3 py-2 text-sm bg-white disabled:bg-gray-50"
          >
            {contactLists.map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
        </div>
      </div>

      {status === 'DRAFT' && (
        <div className="space-y-4 pt-4 border-t">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Date & Time (UTC)</label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="flex-1 rounded-xl border px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleAction("SCHEDULE")}
                disabled={loading || !scheduledAt}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
              >
                <Clock className="w-4 h-4" />
                Schedule
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">Or dispatch immediately through the background queue:</span>
            <button
              type="button"
              onClick={() => void handleAction("START_IMMEDIATELY")}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send Immediately
            </button>
          </div>
        </div>
      )}

      {status === 'SCHEDULED' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-gray-600">Scheduled for: <strong className="text-gray-900">{scheduledAt || 'Future time'}</strong></p>
          <button
            type="button"
            onClick={() => void handleAction("CANCEL")}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancel Schedule
          </button>
        </div>
      )}

      {status === 'RUNNING' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-sm font-medium text-emerald-700">Campaign actively sending via QStash queue...</span>
          </div>
          <button
            type="button"
            onClick={() => void handleAction("PAUSE")}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-sm font-medium transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
        </div>
      )}

      {status === 'PAUSED' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-amber-700 font-medium">Campaign paused.</span>
          <button
            type="button"
            onClick={() => void handleAction("RESUME")}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
