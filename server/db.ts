import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

import { getRequiredSecret } from "./utils/secrets";

const databaseUrl = getRequiredSecret("database_url", "DATABASE_URL");

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
