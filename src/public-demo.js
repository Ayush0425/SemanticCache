import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "./config/db.js";
import { env } from "./config/env.js";

const visitorSchema = z.uuid();

export function requireDemoProxy(req, res, next) {
    if (!env.PUBLIC_DEMO) return next();
    const provided = Buffer.from(req.get("x-semanticcache-proxy") ?? "");
    const expected = Buffer.from(env.PUBLIC_PROXY_SECRET);
    const visitor = visitorSchema.safeParse(req.get("x-semanticcache-visitor"));
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected) || !visitor.success) {
        return res.status(401).json({ success: false, message: "Open the public demo to use this API." });
    }
    res.locals.visitorId = visitor.data;
    return next();
}

async function reserve(client, scope, limit) {
    const { rowCount } = await client.query(
        `INSERT INTO public_request_limits (day, scope, requests)
         VALUES ((now() AT TIME ZONE 'UTC')::date, $1, 1)
         ON CONFLICT (day, scope) DO UPDATE SET requests = public_request_limits.requests + 1
         WHERE public_request_limits.requests < $2
         RETURNING requests`,
        [scope, limit],
    );
    return rowCount > 0;
}

export async function claimPublicRequest(visitorId) {
    const client = await db.connect();
    let rollbackError;
    try {
        await client.query("BEGIN");
        const allowed = await reserve(client, "global", env.PUBLIC_DAILY_LIMIT)
            && await reserve(client, visitorId, env.PUBLIC_VISITOR_DAILY_LIMIT);
        await client.query(allowed ? "COMMIT" : "ROLLBACK");
        return allowed;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (error) {
            rollbackError = error;
        }
        throw error;
    } finally {
        client.release(rollbackError);
    }
}

export function startPublicRetention() {
    if (!env.PUBLIC_DEMO) return;
    const prune = async () => {
        try {
            await db.query(`DELETE FROM cache_entries WHERE expires_at <= now();
                DELETE FROM cache_request_metrics WHERE occurred_at < now() - interval '7 days';
                DELETE FROM public_request_limits WHERE day < (now() AT TIME ZONE 'UTC')::date;`);
        } catch (error) {
            console.error("Public demo retention failed:", error.code ?? error.name);
        }
    };
    void prune();
    setInterval(prune, 5 * 60_000).unref();
}
