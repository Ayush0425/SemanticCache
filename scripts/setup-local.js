import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const envPath = new URL("../.env", import.meta.url);
const password = randomBytes(24).toString("hex");
const config = [
    "POSTGRES_USER=postgres",
    `POSTGRES_PASSWORD=${password}`,
    "POSTGRES_DB=semantic_cache",
    `DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:5433/semantic_cache`,
    "",
].join("\n");

try {
    await writeFile(envPath, config, { flag: "wx", mode: 0o600 });
    console.log("Created local .env with a generated database password.");
} catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Using the existing local .env.");
}
