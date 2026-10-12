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
    findMany: async () => [
      {
        id: "c-1",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        company: "Acme Corp",
        customFields: { role: "Admin", tier: "Gold" },
        createdAt: new Date(),
      },
      {
        id: "c-2",
        email: "bob@example.com",
        firstName: "Bob",
        lastName: "Jones",
        company: "Beta Inc",
        customFields: { role: "Member", tier: "Silver" },
        createdAt: new Date(),
      },
    ],
    count: async () => 2,
    create: async (args: any) => ({
      id: "contact-" + Math.random().toString(36).substring(2, 9),
      ...args.data,
      createdAt: new Date(),
    }),
    update: async (args: any) => ({
      id: args.where.id,
      email: "updated@example.com",
      firstName: "Updated",
      lastName: "User",
      company: "Corp",
      customFields: {},
      ...args.data,
    }),
    delete: async () => ({ success: true }),
  },
  $transaction: async (promises: any[]) => {
    if (Array.isArray(promises)) {
      return Promise.all(promises);
    }
    return promises;
  },
};
