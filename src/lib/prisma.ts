import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const requestClients = new WeakMap<object, PrismaClient>();

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "";
  return new PrismaClient({
    // PostgreSQL goes through the Neon driver adapter; local SQLite uses Prisma's built-in engine.
    ...(url.startsWith("postgres") ? { adapter: new PrismaNeon({ connectionString: url }) } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getRequestScope(): object | undefined {
  try {
    return getCloudflareContext().ctx;
  } catch {
    return undefined;
  }
}

function getPrismaClient() {
  // Workers cannot reuse database connections across requests, so each request gets its own client.
  const scope = getRequestScope();
  if (scope) {
    let client = requestClients.get(scope);
    if (!client) {
      client = createPrismaClient();
      requestClients.set(scope, client);
    }
    return client;
  }

  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
