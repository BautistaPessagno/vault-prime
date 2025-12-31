import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

config({ path: ".env" }); // or .env

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("Missing POSTGRES_URL.");
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
