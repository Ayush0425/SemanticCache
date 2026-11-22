import { env } from "./config/env.js";
import * as gemini from "./gemini.js";
import * as ollama from "./ollama.js";

const hosted = env.MODEL_PROVIDER === "gemini";
export const { embed, embedMany, generate } = hosted ? gemini : ollama;
export const embeddingModel = hosted ? env.GEMINI_EMBEDDING_MODEL : env.EMBEDDING_MODEL;
export const modelScope = hosted
    ? ["gemini", embeddingModel, env.GEMINI_GENERATION_MODEL, gemini.dimensions]
    : [embeddingModel, env.GENERATION_MODEL];
