import { db } from "./config/db.js";

const outcomes = ["exact", "semantic", "miss", "rejected"];
const windowHours = 24;

export async function recordRequest(outcome, latencyMs) {
    try {
        await db.query(
            "INSERT INTO cache_request_metrics (outcome, latency_ms) VALUES ($1, $2)",
            [outcome, latencyMs],
        );
    } catch (error) {
        console.error("Cache metrics write failed:", error.code ?? error.name);
    }
}

export async function readStats() {
    const { rows } = await db.query(
        `SELECT outcome, count(*) AS requests,
                percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms) AS median_ms,
                percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
         FROM cache_request_metrics
         WHERE occurred_at >= now() - make_interval(hours => $1)
         GROUP BY outcome`,
        [windowHours],
    );
    const byOutcome = new Map(rows.map((row) => [row.outcome, row]));
    const breakdown = outcomes.map((outcome) => {
        const row = byOutcome.get(outcome);
        return {
            outcome,
            requests: Number(row?.requests ?? 0),
            medianMs: row?.median_ms ?? null,
            p95Ms: row?.p95_ms ?? null,
        };
    });
    const totalRequests = breakdown.reduce((sum, row) => sum + row.requests, 0);
    const generationCallsSkipped = breakdown
        .filter(({ outcome }) => outcome === "exact" || outcome === "semantic")
        .reduce((sum, row) => sum + row.requests, 0);
    return {
        windowHours,
        totalRequests,
        generationCallsSkipped,
        hitRate: totalRequests ? generationCallsSkipped / totalRequests : null,
        breakdown,
    };
}
