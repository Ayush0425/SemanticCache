import { env } from "./config/env.js";
import { ModelError, toFloatVector, validateAnswer } from "./model-utils.js";

export const dimensions = 768;

async function requestGemini(model, method, body) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(35_000),
        });
        if (response.status === 429) throw new ModelError("The hosted model is at its usage limit. Try again later.");
        if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
        return await response.json();
    } catch (cause) {
        if (cause instanceof ModelError) throw cause;
        throw new ModelError("Could not get a response from the hosted model.", { cause });
    }
}

function embeddingRequest(prompt) {
    return {
        model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text: prompt }] },
        outputDimensionality: dimensions,
    };
}

function parseEmbedding(embedding) {
    const values = toFloatVector(embedding?.values);
    if (values.length !== dimensions) throw new ModelError("Gemini returned an unexpected embedding size.");
    return values;
}

export async function embed(prompt) {
    const data = await requestGemini(env.GEMINI_EMBEDDING_MODEL, "embedContent", embeddingRequest(prompt));
    return parseEmbedding(data?.embedding);
}

export async function embedMany(prompts) {
    const data = await requestGemini(env.GEMINI_EMBEDDING_MODEL, "batchEmbedContents", {
        requests: prompts.map(embeddingRequest),
    });
    if (!Array.isArray(data?.embeddings) || data.embeddings.length !== prompts.length) {
        throw new ModelError("Gemini returned the wrong number of embeddings.");
    }
    return data.embeddings.map(parseEmbedding);
}

export async function generate(prompt) {
    const data = await requestGemini(env.GEMINI_GENERATION_MODEL, "generateContent", {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512 },
    });
    const parts = data?.candidates?.[0]?.content?.parts;
    const answer = Array.isArray(parts)
        ? parts.filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("")
        : undefined;
    return validateAnswer(answer);
}
