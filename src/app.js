import express from "express";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { answerPrompt } from "./cache.js";
import { db } from "./config/db.js";
import { env } from "./config/env.js";
import { ModelError } from "./model-utils.js";
import { claimPublicRequest, requireDemoProxy } from "./public-demo.js";
import { readStats, recordRequest } from "./stats.js";

const app = express();
app.disable("x-powered-by");

if (!env.PUBLIC_DEMO) {
    app.use(express.static(fileURLToPath(new URL("./public/", import.meta.url))));
}

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
        return res.json({ success: true, message: "Cache database is ready.", publicDemo: env.PUBLIC_DEMO });
    } catch (error) {
        console.error("Database readiness failed:", error.code ?? error.name);
        return res.status(503).json({ success: false, message: "Cache database is unavailable." });
    }
});

app.get("/api/v1/stats", requireDemoProxy, async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!db) {
        return res.status(503).json({ success: false, message: "DATABASE_URL is required." });
    }
    try {
        return res.json({ success: true, ...await readStats() });
    } catch (error) {
        console.error("Cache stats unavailable:", error.code ?? error.name);
        return res.status(503).json({
            success: false,
            message: error.code === "42P01"
                ? "Run npm run db:migrate to enable cache stats."
                : "Cache statistics are temporarily unavailable.",
        });
    }
});

const querySchema = z.object({
    prompt: z.string().trim().min(1).max(2000).refine((prompt) => !prompt.includes("\0")),
    demoRunId: z.uuid().optional(),
});
const parseQueryBody = env.PUBLIC_DEMO
    ? express.json({ limit: "16kb" })
    : [express.json(), express.urlencoded({ extended: true })];

app.post("/api/v1/query", requireDemoProxy, parseQueryBody, async (req, res) => {
    res.set("Cache-Control", "no-store");
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
        const { visitorId } = res.locals;
        if (visitorId && !await claimPublicRequest(visitorId)) {
            return res.status(429).json({ success: false, message: "The demo has reached its daily request limit. Try again tomorrow (UTC)." });
        }
        const startedAt = performance.now();
        const { prompt, demoRunId } = query.data;
        const answer = await answerPrompt(prompt, demoRunId, visitorId);
        await recordRequest(answer.semanticRejected ? "rejected" : answer.cache, Math.round(performance.now() - startedAt));
        return res.json({ success: true, ...answer });
    } catch (error) {
        console.error("Cache query failed:", error.cause?.message ?? error.code ?? error.name);
        if (error instanceof ModelError) {
            return res.status(502).json({ success: false, message: error.message });
        }
        return res.status(503).json({ success: false, message: "Cache database is unavailable." });
    }
});

app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({ success: false, message: "The request is too large." });
    }
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "The request body is invalid." });
    }
    return next(error);
});

export default app;
