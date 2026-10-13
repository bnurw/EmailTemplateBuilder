/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Spreadsheet from './components/Spreadsheet';
import ContactImporter from './components/ContactImporter';
import EmailTemplateBuilder from './components/EmailTemplateBuilder';
import CampaignScheduler from './components/CampaignScheduler';
import CampaignAnalytics from './components/CampaignAnalytics';
import SequenceDashboard from './components/SequenceDashboard';
import SegmentManager from './components/SegmentManager';
import { Sparkles, Table, UploadCloud, Mail, CalendarClock, BarChart3, GitBranch, Users } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'segments' | 'sequences' | 'analytics' | 'scheduler' | 'builder' | 'spreadsheet' | 'importer'>('segments');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="border-b bg-white sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Email Outreach SaaS (Phase 7)</h1>
            <p className="text-xs text-gray-500">Contact Segmentation, Smart Targeting & Tags</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'segments' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            Segments & Tags
          </button>
          <button
            onClick={() => setActiveTab('sequences')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sequences' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GitBranch className="w-4 h-4 text-purple-600" />
            Sequences
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analytics' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'scheduler' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarClock className="w-4 h-4 text-purple-600" />
            Scheduler
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'builder' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-600" />
            Email Builder
          </button>
          <button
            onClick={() => setActiveTab('spreadsheet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'spreadsheet' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table className="w-4 h-4 text-blue-600" />
            Spreadsheet
          </button>
          <button
            onClick={() => setActiveTab('importer')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'importer' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-indigo-600" />
            Importer
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        {activeTab === 'segments' && <SegmentManager />}
        {activeTab === 'sequences' && <SequenceDashboard />}
        {activeTab === 'analytics' && <CampaignAnalytics campaignId="camp-1" />}
        {activeTab === 'scheduler' && (
          <CampaignScheduler
            campaignId="camp-1"
            initialStatus="RUNNING"
            sendingAccounts={[{ id: 'acc-1', name: 'Primary Resend Account', provider: 'RESEND' }]}
            contactLists={[{ id: 'list-1', name: 'Default Contact List' }]}
          />
        )}
        {activeTab === 'builder' && (
          <EmailTemplateBuilder
            availableVariables={["email", "FirstName", "LastName", "Company", "Role", "Tier"]}
            previewRecipients={[
              { email: "alice@example.com", FirstName: "Alice", LastName: "Smith", Company: "Acme Corp", Role: "Admin", Tier: "Gold" },
              { email: "bob@example.com", FirstName: "Bob", LastName: "Jones", Company: "Beta Inc", Role: "Member", Tier: "Silver" },
            ]}
            sendingAccountId="acc-1"
          />
        )}
        {activeTab === 'spreadsheet' && <Spreadsheet contactListId="list-1" />}
        {activeTab === 'importer' && <ContactImporter contactListId="list-1" />}
      </main>
    </div>
  );
}
