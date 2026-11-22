import { db } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { embedMany, embeddingModel } from "../src/models.js";
import { hasUnitConflict } from "../src/unit-constraints.js";
import { holdoutPairs } from "./holdout.js";
import { pairs } from "./pairs.js";

function summarize(results, threshold, guardUnits) {
    const counts = { correctHits: 0, correctMisses: 0, falseHits: 0, falseMisses: 0 };
    for (const { shouldHit, score, unitConflict } of results) {
        if (score >= threshold && !(guardUnits && unitConflict)) {
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
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== "--holdout")) {
        throw new Error("Use npm run evaluate or npm run evaluate:holdout.");
    }
    const isHoldout = args[0] === "--holdout";
    const dataset = isHoldout ? holdoutPairs : pairs;
    const threshold = env.CACHE_SIMILARITY_THRESHOLD;
    const prompts = [...new Set(dataset.flatMap(({ cached, query }) => [cached, query]))];
    console.log(`Scoring ${dataset.length} ${isHoldout ? "holdout" : "development"} pairs with ${embeddingModel} at threshold ${threshold}.`);
    const embeddings = await embedMany(prompts);
    const vectors = new Map(prompts.map((prompt, index) => [prompt, JSON.stringify(embeddings[index])]));

    const results = [];
    for (const pair of dataset) {
        const { rows: [{ score }] } = await db.query(
            "SELECT 1 - ($1::vector <=> $2::vector) AS score",
            [vectors.get(pair.cached), vectors.get(pair.query)],
        );
        results.push({ ...pair, score, unitConflict: hasUnitConflict(pair.cached, pair.query) });
    }
    console.table(results.map(({ name, shouldHit, score, unitConflict }) => {
        const similarityHit = score >= threshold;
        const hit = similarityHit && !unitConflict;
        return {
            case: name,
            expected: shouldHit ? "hit" : "miss",
            similarityOnly: similarityHit ? "hit" : "miss",
            predicted: hit ? "hit" : "miss",
            similarity: score.toFixed(4),
            guard: similarityHit && unitConflict ? "blocked" : "",
            result: hit === shouldHit ? "correct" : hit ? "false hit" : "false miss",
        };
    }));

    const thresholds = isHoldout ? [threshold]
        : [...new Set([0.85, 0.90, 0.92, 0.94, 0.96, 0.98, 0.99, threshold])]
            .sort((first, second) => first - second);
    console.log("Similarity only");
    console.table(thresholds.map((cutoff) => summarize(results, cutoff, false)));
    console.log("Similarity + unit check");
    console.table(thresholds.map((cutoff) => ({
        ...summarize(results, cutoff, true),
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
