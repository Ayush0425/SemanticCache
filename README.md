# SemanticCache

SemanticCache reuses model answers for exact and similar prompts. PostgreSQL stores the answers and pgvector compares their embeddings using cosine similarity. Ollama runs both models locally.

## Run locally

Install Node.js 22+ and Docker with Compose. From the repository root, run these PowerShell commands:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose --profile models up -d --wait
npm run db:migrate
docker compose exec ollama ollama pull embeddinggemma
docker compose exec ollama ollama pull qwen2.5:1.5b
npm start
```

If you already have a project-root `.env`, merge in the example settings and keep your existing credentials. If you already run Ollama separately, start Compose without `--profile models` and pull the models through your Ollama installation. Compose publishes PostgreSQL on loopback port 5433. The default cache TTL is one day.

## Browser playground

Open [the playground](http://127.0.0.1:5000/) after running `npm start`. Send a prompt to see the answer, cache outcome, and browser round-trip time. Semantic hits also show the matched prompt and its cosine similarity.

**Run demo** sends the same question twice, then sends a paraphrase. Each run uses its own cache scope with a TTL of up to 15 minutes, so previous requests won't warm up the next run. The paraphrase still uses the configured similarity threshold. Clear history removes the displayed requests from the current page.

## Try the API

In another PowerShell terminal:

```powershell
$api = 'http://127.0.0.1:5000/api/v1'
Invoke-RestMethod "$api/ready"
$questions = @(
    'Explain why the sky looks blue.',
    'Explain why the sky looks blue.',
    'Why does the sky appear blue?'
)
foreach ($question in $questions) {
    Invoke-RestMethod "$api/query" -Method Post -ContentType 'application/json' `
        -Body (@{ prompt = $question } | ConvertTo-Json)
}
```

With an empty cache, the first request returns `cache: "miss"` and the repeat returns `cache: "exact"`. The paraphrase returns `cache: "semantic"` if its embedding meets `CACHE_SIMILARITY_THRESHOLD`. A semantic hit includes the matched prompt and score. Tune the threshold with both paraphrases and look-alike questions that need different answers.

`GET /api/v1/health` checks the API process. `GET /api/v1/ready` checks database connectivity and schema setup. Cache entries are shared by all callers, so use this prototype as a single-user local service. Expired rows are skipped at lookup and overwritten when the same prompt is regenerated. To reclaim expired rows, run `DELETE FROM cache_entries WHERE expires_at <= now();`.
