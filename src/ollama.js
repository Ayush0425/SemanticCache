import { env } from "./config/env.js";

async function requestModel(path, body) {
    try {
        const response = await fetch(new URL(path, env.OLLAMA_URL), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) {
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }
        return await response.json();
    } catch (cause) {
        throw new ModelError("Could not get a response from Ollama.", { cause });
    }
}

export class ModelError extends Error {}

export async function embed(prompt) {
    const data = await requestModel("/api/embed", {
        model: env.EMBEDDING_MODEL,
        input: prompt,
        truncate: false,
    });
    const vector = data?.embeddings?.[0];
    if (!Array.isArray(vector) || vector.length > 16_000 || !vector.every(Number.isFinite)) {
        throw new ModelError("Ollama returned an invalid embedding.");
    }
    const floatVector = vector.map(Math.fround);
    if (!floatVector.every(Number.isFinite) || !floatVector.some((value) => value !== 0)) {
        throw new ModelError("Ollama returned an invalid embedding.");
    }
    return floatVector;
}

export async function generate(prompt) {
    const data = await requestModel("/api/generate", {
        model: env.GENERATION_MODEL,
        prompt,
        stream: false,
    });
    if (typeof data?.response !== "string" || !data.response.trim() || data.response.includes("\0")) {
        throw new ModelError("Ollama returned an invalid answer.");
    }
    return data.response;
}
