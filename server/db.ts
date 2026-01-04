import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
    );
}

// Fix for IPv6 localhost issue (::1)
let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes("@localhost")) {
    connectionString = connectionString.replace("@localhost", "@127.0.0.1");
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
