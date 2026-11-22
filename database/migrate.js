import { readFile } from "node:fs/promises";
import { db } from "../src/config/db.js";

if (!db) {
    console.error("Set DATABASE_URL before running the database migration.");
    process.exitCode = 1;
} else {
    try {
        const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
        await db.query(schema);
        console.log("SemanticCache database schema is ready.");
    } catch (error) {
        console.error("Database migration failed:", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}
