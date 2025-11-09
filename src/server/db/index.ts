import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import pgvector from "pgvector/pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });

pool.on("connect", async (client: PoolClient) => {
  await pgvector.registerTypes(client);
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;

export { schema };
