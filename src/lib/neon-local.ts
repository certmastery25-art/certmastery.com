import { neonConfig } from "@neondatabase/serverless";

// Hostname used by docker-compose.yml's local Neon proxy; it resolves to 127.0.0.1.
const LOCAL_HOST = "db.localtest.me";

// Points the Neon driver at the local proxy when DATABASE_URL uses LOCAL_HOST.
// Production connection strings are left untouched.
export function configureNeonForLocal(connectionString: string | undefined) {
  if (!connectionString) return;
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return;
  }
  if (host !== LOCAL_HOST) return;
  neonConfig.fetchEndpoint = (fetchHost) => (fetchHost === LOCAL_HOST ? `http://${fetchHost}:4444/sql` : `https://${fetchHost}/sql`);
  neonConfig.useSecureWebSocket = false;
  neonConfig.wsProxy = (wsHost) => (wsHost === LOCAL_HOST ? `${wsHost}:4444/v2` : `${wsHost}/v2`);
}
