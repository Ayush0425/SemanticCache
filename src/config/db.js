import pg from "pg";
import { env } from "./env.js";

export const db = env.DATABASE_URL
    ? new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 })
    : null;

db?.on("error", (error) => {
    console.error("Idle database connection failed:", error.code ?? error.name);
});
