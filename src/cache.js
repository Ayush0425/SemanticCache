import { createHash } from "node:crypto";
import { db } from "./config/db.js";
import { env } from "./config/env.js";
import { embed, generate, modelScope } from "./models.js";
import { hasUnitConflict } from "./unit-constraints.js";

export async function answerPrompt(prompt, demoRunId, visitorId) {
    const scope = visitorId ? [...modelScope, "visitor", visitorId] : modelScope;
    const cacheScope = JSON.stringify(demoRunId ? [...scope, demoRunId] : scope);
    const ttl = demoRunId || visitorId ? Math.min(env.CACHE_TTL_SECONDS, 15 * 60) : env.CACHE_TTL_SECONDS;
    const hash = createHash("sha256").update(prompt).digest("hex");
    const exact = await db.query(
        `SELECT answer FROM cache_entries
         WHERE model_scope = $1 AND prompt_hash = $2 AND expires_at > now()`,
        [cacheScope, hash],
    );
    if (exact.rowCount) {
        return { answer: exact.rows[0].answer, cache: "exact", similarity: 1 };
    }

    const embedding = JSON.stringify(await embed(prompt));
    const nearest = await db.query(
        `SELECT answer, prompt, 1 - distance AS similarity
         FROM (
             SELECT answer, prompt, CASE
                 WHEN vector_dims(embedding) = vector_dims($2::vector)
                 THEN embedding <=> $2::vector
             END AS distance
             FROM cache_entries
             WHERE model_scope = $1 AND expires_at > now()
         ) AS candidates
         WHERE 1 - distance >= $3::double precision
         ORDER BY distance, prompt
         LIMIT 1`,
        [cacheScope, embedding, env.CACHE_SIMILARITY_THRESHOLD],
    );
    const candidate = nearest.rows[0];
    if (candidate && !hasUnitConflict(candidate.prompt, prompt)) {
        const { answer, prompt: matchedPrompt, similarity } = candidate;
        return { answer, cache: "semantic", similarity, matchedPrompt };
    }

    const answer = await generate(prompt);
    await db.query(
        `INSERT INTO cache_entries (model_scope, prompt_hash, prompt, answer, embedding, expires_at)
         VALUES ($1, $2, $3, $4, $5::vector, now() + $6::integer * interval '1 second')
         ON CONFLICT (model_scope, prompt_hash) DO UPDATE
         SET prompt = EXCLUDED.prompt, answer = EXCLUDED.answer,
             embedding = EXCLUDED.embedding, expires_at = EXCLUDED.expires_at
         WHERE cache_entries.expires_at <= now()`,
        [cacheScope, hash, prompt, answer, embedding, ttl],
    );
    return { answer, cache: "miss", similarity: null, semanticRejected: Boolean(candidate) };
}
