import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    PORT: z.coerce.number().default(5000),
    HOST: z.string().min(1).default("127.0.0.1"),
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string().min(1).optional(),
    OLLAMA_URL: z.url({ protocol: /^https?$/ }).default("http://127.0.0.1:11434"),
    MODEL_PROVIDER: z.enum(["ollama", "gemini"]).default("ollama"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_EMBEDDING_MODEL: z.string().regex(/^[a-z0-9.-]+$/).default("gemini-embedding-2"),
    GEMINI_GENERATION_MODEL: z.string().regex(/^[a-z0-9.-]+$/).default("gemini-3.1-flash-lite"),
    PUBLIC_PROXY_SECRET: z.string().min(32).optional(),
    PUBLIC_DEMO: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    PUBLIC_DAILY_LIMIT: z.coerce.number().int().positive().default(60),
    PUBLIC_VISITOR_DAILY_LIMIT: z.coerce.number().int().positive().default(12),
    EMBEDDING_MODEL: z.string().min(1).default("embeddinggemma"),
    GENERATION_MODEL: z.string().min(1).default("qwen2.5:1.5b"),
    CACHE_SIMILARITY_THRESHOLD: z.coerce.number().gt(0).lte(1).default(0.92),
    CACHE_TTL_SECONDS: z.coerce.number().int().positive().max(31536000).default(86400),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("Invalid environment variables:", parsedEnv.error.issues.map(({ path }) => path.join(".")).join(", "));
    process.exit(1);
}

export const env = parsedEnv.data;

if (env.MODEL_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
    console.error("Set GEMINI_API_KEY when using the Gemini model provider.");
    process.exit(1);
}

if (env.PUBLIC_DEMO && (!env.PUBLIC_PROXY_SECRET || !env.DATABASE_URL)) {
    console.error("Set PUBLIC_PROXY_SECRET and DATABASE_URL for the public demo.");
    process.exit(1);
}
