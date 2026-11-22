import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(5000),
    HOST: z.string().min(1).default("127.0.0.1"),
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string().min(1).optional(),
    OLLAMA_URL: z.url({ protocol: /^https?$/ }).default("http://127.0.0.1:11434"),
    EMBEDDING_MODEL: z.string().min(1).default("embeddinggemma"),
    GENERATION_MODEL: z.string().min(1).default("qwen2.5:1.5b"),
    CACHE_SIMILARITY_THRESHOLD: z.coerce.number().gt(0).lte(1).default(0.92),
    CACHE_TTL_SECONDS: z.coerce.number().int().positive().max(31536000).default(86400),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("Invalid environment variables:", parsedEnv.error);
    process.exit(1);
}

export const env = parsedEnv.data;
