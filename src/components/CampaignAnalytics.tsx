"use client";

import { useEffect, useState } from "react";
import { BarChart3, Mail, Send, CheckCircle2, AlertTriangle, MousePointerClick, Eye, UserX, RefreshCcw } from "lucide-react";

type AnalyticsMetrics = {
  totalRecipients: number;
  pending: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  skipped: number;
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  openRate: string;
  clickRate: string;
};

type Props = {
  campaignId: string;
};

export default function CampaignAnalytics({ campaignId }: Props) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/analytics`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load analytics.");
      setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, [campaignId]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 bg-white border rounded-2xl">Loading campaign analytics...</div>;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => void fetchAnalytics()} className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg">
          <RefreshCcw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Campaign Performance Analytics</h3>
          <p className="text-xs text-gray-500">Real-time delivery, engagement, and bounce metrics</p>
        </div>
        <button
          onClick={() => void fetchAnalytics()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Total Recipients</p>
            <h4 className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalRecipients}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Successfully Sent</p>
            <h4 className="text-2xl font-bold text-emerald-600 mt-1">{metrics.sent}</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Open Rate</p>
            <h4 className="text-2xl font-bold text-indigo-600 mt-1">{metrics.openRate}%</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Click Rate</p>
            <h4 className="text-2xl font-bold text-purple-600 mt-1">{metrics.clickRate}%</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <MousePointerClick className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border rounded-2xl p-6 shadow-xs space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Delivery Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-gray-50 border">
              <span className="text-xs text-gray-500 block">Pending</span>
              <strong className="text-lg font-bold text-gray-900">{metrics.pending}</strong>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border">
              <span className="text-xs text-gray-500 block">Delivered</span>
              <strong className="text-lg font-bold text-emerald-600">{metrics.delivered}</strong>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border">
              <span className="text-xs text-gray-500 block">Bounced</span>
              <strong className="text-lg font-bold text-amber-600">{metrics.bounced}</strong>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border">
              <span className="text-xs text-gray-500 block">Failed / Skipped</span>
              <strong className="text-lg font-bold text-red-600">{metrics.failed + metrics.skipped}</strong>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-xs space-y-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            Engagement Summary
          </h4>
          <div className="space-y-3 pt-2 text-sm">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-gray-600">Total Opens</span>
              <span className="font-bold text-gray-900">{metrics.opens}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-gray-600">Unique Opens</span>
              <span className="font-bold text-gray-900">{metrics.uniqueOpens}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-gray-600">Total Clicks</span>
              <span className="font-bold text-gray-900">{metrics.clicks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Unique Clicks</span>
              <span className="font-bold text-gray-900">{metrics.uniqueClicks}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
