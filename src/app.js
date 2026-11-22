import express from "express";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { answerPrompt } from "./cache.js";
import { db } from "./config/db.js";
import { ModelError } from "./ollama.js";

const app = express();

// Global middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(fileURLToPath(new URL("./public/", import.meta.url))));

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SemanticCache API is running",
    });
});

app.get("/api/v1/ready", async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ success: false, message: "DATABASE_URL is required." });
        }
        await db.query("SELECT embedding FROM cache_entries LIMIT 0");
        return res.json({ success: true, message: "Cache database is ready." });
    } catch (error) {
        console.error("Database readiness failed:", error.code ?? error.name);
        return res.status(503).json({ success: false, message: "Cache database is unavailable." });
    }
});

const querySchema = z.object({
    prompt: z.string().trim().min(1).max(2000).refine((prompt) => !prompt.includes("\0")),
    demoRunId: z.uuid().optional(),
});

app.post("/api/v1/query", async (req, res) => {
    const query = querySchema.safeParse(req.body);
    if (!query.success) {
        return res.status(400).json({
            success: false,
            message: "Provide a prompt of 1 to 2000 characters without null bytes and a valid demo ID if supplied.",
        });
    }
    if (!db) {
        return res.status(503).json({ success: false, message: "DATABASE_URL is required." });
    }
    try {
        const { prompt, demoRunId } = query.data;
        return res.json({ success: true, ...await answerPrompt(prompt, demoRunId) });
    } catch (error) {
        console.error("Cache query failed:", error.cause?.message ?? error.code ?? error.name);
        if (error instanceof ModelError) {
            return res.status(502).json({ success: false, message: error.message });
        }
        return res.status(503).json({ success: false, message: "Cache database is unavailable." });
    }
});

export default app;
