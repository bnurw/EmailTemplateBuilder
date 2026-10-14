// Extended database and mock persistence layer for Phase 8C Leases & Rate Limiting

const campaignsStore = new Map<string, any>();
const recipientsStore = new Map<string, any>();
const eventsStore = new Map<string, any[]>();
const clicksStore = new Map<string, any[]>();
const suppressionStore = new Set<string>();
const sequencesStore = new Map<string, any>();
const stagesStore = new Map<string, any[]>();
const executionsStore = new Map<string, any[]>();
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
        leaseExpiresAt: null,
        ...d,
      }));
      recipientsStore.set(args.data?.[0]?.campaignId || 'camp-1', [...list, ...newRecipients]);
      return { count: newRecipients.length };
    },
    findFirst: async (args: any) => {
      const id = args?.where?.id;
      for (const list of recipientsStore.values()) {
        const found = list.find((r: any) => r.id === id);
        if (found) return found;
      }
      return null;
    },
    findMany: async (args: any) => {
      const campaignId = args?.where?.campaignId;
      const list = recipientsStore.get(campaignId || 'camp-1') || [
        { id: 'rec-1', campaignId: 'camp-1', email: 'alice@example.com', firstName: 'Alice', status: 'SENT', sentAt: new Date() },
        { id: 'rec-2', campaignId: 'camp-1', email: 'bob@example.com', firstName: 'Bob', status: 'PENDING', leaseExpiresAt: null },
      ];
      return list.slice(0, args?.take || 50);
    },
    update: async (args: any) => {
      const id = args?.where?.id;
      for (const [campId, list] of recipientsStore.entries()) {
        const idx = list.findIndex((r: any) => r.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...args.data };
          return list[idx];
        }
      }
      return { id, ...args.data };
    },
    updateMany: async (args: any) => {
      const campaignId = args.where.campaignId;
      const list = recipientsStore.get(campaignId) || [];
      let count = 0;
      for (const r of list) {
        if (r.status === args.where.status.in[0] || (r.status === 'PROCESSING' && r.leaseExpiresAt < new Date())) {
          Object.assign(r, args.data);
          count++;
        }
      }
      return { count };
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
    findMany: async () => [],
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
