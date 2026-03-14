import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

import { getSecret } from "./utils/secrets";

const databaseUrl = getSecret("database_url", "DATABASE_URL");

export let pool: Pool | null = null;
export let db: NodePgDatabase<typeof schema> | null = null;

if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
  });
  db = drizzle(pool, { schema });
} else {
  console.warn("[DB] DATABASE_URL not set — running with in-memory storage.");
}
