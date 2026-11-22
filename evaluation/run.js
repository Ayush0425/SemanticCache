import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { embedMany } from "../src/ollama.js";
import { pairs } from "./pairs.js";

function summarize(results, threshold) {
    const counts = { correctHits: 0, correctMisses: 0, falseHits: 0, falseMisses: 0 };
    for (const { shouldHit, score } of results) {
        if (score >= threshold) {
            counts[shouldHit ? "correctHits" : "falseHits"]++;
        } else {
            counts[shouldHit ? "falseMisses" : "correctMisses"]++;
        }
    }
    const hits = counts.correctHits + counts.falseHits;
    const expectedHits = counts.correctHits + counts.falseMisses;
    return {
        threshold,
        ...counts,
        precision: hits ? percent(counts.correctHits / hits) : "n/a",
        recall: percent(counts.correctHits / expectedHits),
    };
}

function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

async function evaluate() {
    if (!db) throw new Error("Set DATABASE_URL before running the evaluation.");
    const threshold = env.CACHE_SIMILARITY_THRESHOLD;
    const prompts = [...new Set(pairs.flatMap(({ cached, query }) => [cached, query]))];
    console.log(`Scoring ${pairs.length} pairs with ${env.EMBEDDING_MODEL} at the configured threshold of ${threshold}.`);
    const embeddings = await embedMany(prompts);
    const vectors = new Map(prompts.map((prompt, index) => [prompt, JSON.stringify(embeddings[index])]));

    const results = [];
    for (const pair of pairs) {
        const { rows: [{ score }] } = await db.query(
            "SELECT 1 - ($1::vector <=> $2::vector) AS score",
            [vectors.get(pair.cached), vectors.get(pair.query)],
        );
        results.push({ ...pair, score });
    }
    console.table(results.map(({ name, shouldHit, score }) => {
        const hit = score >= threshold;
        return {
            case: name,
            expected: shouldHit ? "hit" : "miss",
            predicted: hit ? "hit" : "miss",
            similarity: score.toFixed(4),
            result: hit === shouldHit ? "correct" : hit ? "false hit" : "false miss",
        };
    }));

    const thresholds = [...new Set([0.85, 0.90, 0.92, 0.94, 0.96, 0.98, 0.99, threshold])]
        .sort((first, second) => first - second);
    console.table(thresholds.map((cutoff) => ({
        ...summarize(results, cutoff),
        configured: cutoff === threshold ? "yes" : "",
    })));
}

try {
    await evaluate();
} catch (error) {
    console.error("Evaluation failed:", error.message);
    process.exitCode = 1;
} finally {
    await db?.end();
}
