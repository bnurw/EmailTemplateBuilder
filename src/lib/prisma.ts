// Extended database and mock persistence layer for Phase 7 Tags & Segments

const campaignsStore = new Map<string, any>();
const recipientsStore = new Map<string, any>();
const eventsStore = new Map<string, any[]>();
const clicksStore = new Map<string, any[]>();
const suppressionStore = new Set<string>();
const sequencesStore = new Map<string, any>();
const stagesStore = new Map<string, any[]>();
const executionsStore = new Map<string, any[]>();
const tagsStore = new Map<string, any>([
  ['tag-1', { id: 'tag-1', userId: 'user-1', name: 'VIP Customer' }],
  ['tag-2', { id: 'tag-2', userId: 'user-1', name: 'Enterprise' }],
]);
const contactTagsStore = new Map<string, Set<string>>([
  ['c-1', new Set(['tag-1'])],
  ['c-2', new Set(['tag-2'])],
]);
const segmentsStore = new Map<string, any>([
  ['seg-1', { id: 'seg-1', userId: 'user-1', name: 'VIP Leads', rules: { op: 'AND', conditions: [{ field: 'company', operator: 'contains', value: 'Acme' }] } }]
]);
const sendingAccountsStore = new Map<string, any>([
  ['acc-1', { id: 'acc-1', userId: 'user-1', name: 'Primary Resend', provider: 'RESEND', credentials: { apiKey: 're_mock_key', fromEmail: 'outreach@example.com' } }]
]);

export const prisma = {
  contactList: {
    findMany: async () => [],
    count: async () => 0,
    create: async (args: any) => ({
      id: "list-1",
      name: args.data.name,
      description: args.data.description,
      columnDefinitions: [],
      userId: args.data.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findFirst: async () => ({
      id: "list-1",
      name: "Default Contact List",
      columnDefinitions: [],
    }),
  },
  contact: {
    findMany: async (args: any) => {
      const contacts = [
        {
          id: "c-1",
          userId: "user-1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          company: "Acme Corp",
          customFields: { Role: "Admin", Tier: "Gold" },
          createdAt: new Date(),
        },
        {
          id: "c-2",
          userId: "user-1",
          email: "bob@example.com",
          firstName: "Bob",
          lastName: "Jones",
          company: "Beta Inc",
          customFields: { Role: "Member", Tier: "Silver" },
          createdAt: new Date(),
        },
      ];
      const userId = args?.where?.userId;
      return contacts.filter((c) => !userId || c.userId === userId);
    },
    count: async () => 2,
    create: async (args: any) => ({
      id: "contact-" + Math.random().toString(36).substring(2, 9),
      ...args.data,
      createdAt: new Date(),
    }),
    update: async (args: any) => ({
      id: args.where.id,
      email: "updated@example.com",
      ...args.data,
    }),
    delete: async () => ({ success: true }),
  },
  tag: {
    findMany: async (args: any) => {
      const userId = args?.where?.userId;
      return Array.from(tagsStore.values()).filter((t) => !userId || t.userId === userId);
    },
    create: async (args: any) => {
      const id = "tag-" + Math.random().toString(36).substring(2, 9);
      const tag = { id, ...args.data, createdAt: new Date() };
      tagsStore.set(id, tag);
      return tag;
    },
    delete: async (args: any) => {
      const id = args?.where?.id;
      tagsStore.delete(id);
      return { success: true };
    },
  },
  segment: {
    findMany: async (args: any) => {
      const userId = args?.where?.userId;
      return Array.from(segmentsStore.values()).filter((s) => !userId || s.userId === userId);
    },
    findFirst: async (args: any) => {
      const id = args?.where?.id;
      if (id && segmentsStore.has(id)) return segmentsStore.get(id);
      return Array.from(segmentsStore.values())[0] || null;
    },
    create: async (args: any) => {
      const id = "seg-" + Math.random().toString(36).substring(2, 9);
      const seg = { id, ...args.data, createdAt: new Date() };
      segmentsStore.set(id, seg);
      return seg;
    },
    update: async (args: any) => {
      const id = args?.where?.id;
      const existing = segmentsStore.get(id) || { id };
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      segmentsStore.set(id, updated);
      return updated;
    },
    delete: async (args: any) => {
      const id = args?.where?.id;
      segmentsStore.delete(id);
      return { success: true };
    },
  },
  suppression: {
    findUnique: async (args: any) => {
      const email = args?.where?.email;
      return suppressionStore.has(email) ? { email, reason: 'UNSUBSCRIBED' } : null;
    },
    create: async (args: any) => {
      suppressionStore.add(args.data.email);
      return args.data;
    },
  },
  sendingAccount: {
    findFirst: async (args: any) => {
      const id = args?.where?.id;
      if (id && sendingAccountsStore.has(id)) return sendingAccountsStore.get(id);
      return Array.from(sendingAccountsStore.values())[0] || null;
    },
  },
  campaign: {
    create: async (args: any) => {
      const id = "camp-" + Math.random().toString(36).substring(2, 9);
      const campaign = {
        id,
        ...args.data,
        status: args.data.status || "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      campaignsStore.set(id, campaign);
      return campaign;
    },
    findFirst: async (args: any) => {
      const id = args?.where?.id;
      if (id && campaignsStore.has(id)) return campaignsStore.get(id);
      const all = Array.from(campaignsStore.values());
      return all[0] || { id: 'camp-1', userId: 'user-1', name: 'Sample Campaign', subject: 'Hello', status: 'RUNNING', sendingAccountId: 'acc-1' };
    },
    update: async (args: any) => {
      const id = args?.where?.id;
      const existing = campaignsStore.get(id) || { id, status: 'RUNNING' };
      const updated = { ...existing, ...args.data, updatedAt: new Date() };
      campaignsStore.set(id, updated);
      return updated;
    },
  },
  campaignRecipient: {
    createMany: async (args: any) => {
      const data = args.data || [];
      const list = recipientsStore.get(args.data?.[0]?.campaignId || 'camp-1') || [];
      const newRecipients = data.map((d: any) => ({
        id: 'rec-' + Math.random().toString(36).substring(2, 9),
        status: 'PENDING',
        attemptCount: 0,
        ...d,
      }));
      recipientsStore.set(args.data?.[0]?.campaignId || 'camp-1', [...list, ...newRecipients]);
      return { count: newRecipients.length };
    },
    findMany: async (args: any) => {
      const campaignId = args?.where?.campaignId;
      const list = recipientsStore.get(campaignId || 'camp-1') || [
        { id: 'rec-1', campaignId: 'camp-1', email: 'alice@example.com', firstName: 'Alice', status: 'SENT', sentAt: new Date() },
        { id: 'rec-2', campaignId: 'camp-1', email: 'bob@example.com', firstName: 'Bob', status: 'PENDING' },
      ];
      if (args?.where?.status) {
        return list.filter((r: any) => r.status === args.where.status).slice(0, args?.take || 50);
      }
      return list.slice(0, args?.take || 50);
    },
    count: async (args: any) => {
      const campaignId = args?.where?.campaignId;
      const list = recipientsStore.get(campaignId || 'camp-1') || [];
      if (args?.where?.status) {
        return list.filter((r: any) => r.status === args.where.status).length;
      }
      return list.length;
    },
  },
  sequence: {
    findMany: async () => [{ id: 'seq-1', name: 'Q3 Enterprise Follow-up', status: 'ACTIVE' }],
  },
  emailEvent: {
    create: async (args: any) => ({ id: 'ev-1', ...args.data }),
    count: async () => 0,
  },
  clickEvent: {
    create: async (args: any) => ({ id: 'cl-1', ...args.data }),
    count: async () => 0,
  },
  $transaction: async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(prisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  },
};
