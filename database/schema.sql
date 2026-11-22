CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cache_entries (
    model_scope text NOT NULL,
    prompt_hash text NOT NULL,
    prompt text NOT NULL,
    answer text NOT NULL,
    embedding vector NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (model_scope, prompt_hash)
);

CREATE INDEX IF NOT EXISTS cache_entries_expires_at_idx
    ON cache_entries (expires_at);

CREATE TABLE IF NOT EXISTS cache_request_metrics (
    occurred_at timestamptz NOT NULL DEFAULT now(),
    outcome text NOT NULL CHECK (outcome IN ('exact', 'semantic', 'miss', 'rejected')),
    latency_ms integer NOT NULL CHECK (latency_ms >= 0)
);

CREATE INDEX IF NOT EXISTS cache_request_metrics_occurred_at_idx
    ON cache_request_metrics (occurred_at);
