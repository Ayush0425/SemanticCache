# SemanticCache

SemanticCache reuses model answers for exact and similar prompts. PostgreSQL stores the answers and pgvector compares their embeddings using cosine similarity. Ollama runs both models locally.

## Run locally

Install Node.js 22+ and Docker with Compose. From the repository root, run these PowerShell commands:

```powershell
npm ci
npm run setup:local
docker compose --profile models up -d --wait
npm run db:migrate
docker compose exec ollama ollama pull embeddinggemma
docker compose exec ollama ollama pull qwen2.5:1.5b
npm start
```

`npm run setup:local` creates an ignored `.env` with a random local PostgreSQL password. If a local `.env` already exists, the command reuses it. The default API address is `127.0.0.1:5000`, PostgreSQL uses `127.0.0.1:5433`, and Ollama uses `127.0.0.1:11434`. If you run Ollama separately, start Compose without `--profile models` and pull the same models in your Ollama installation.

Set `CACHE_SIMILARITY_THRESHOLD` or `CACHE_TTL_SECONDS` in your local `.env` to override the defaults of `0.92` and `86400`. Run `npm run dev` to restart the server automatically when its JavaScript changes.

## Browser playground

Open [the playground](http://127.0.0.1:5000/) after running `npm start`. Send a prompt to see the answer, cache outcome, and browser round-trip time. Semantic hits also show the matched prompt and its cosine similarity.

**Run demo** sends the same question twice, then sends a paraphrase. Each run uses its own cache scope with a TTL of up to 15 minutes, so previous requests won't warm up the next run. The paraphrase still uses the configured similarity threshold. Clear history removes the displayed requests from the current page.

## Cache stats

Run `npm run db:migrate` on an existing installation, then open the **Stats** tab. It shows the last 24 hours of successful requests, the cache hit rate, skipped generation calls, and median and p95 server latency by outcome. A match rejected by the unit check is counted separately from a regular miss. Each metrics row contains only the time, outcome, and latency.

`GET /api/v1/stats` returns the same aggregates as JSON. To remove older metrics rows, run `DELETE FROM cache_request_metrics WHERE occurred_at < now() - interval '7 days';`.

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

Before reusing the nearest semantic match, the API checks for conflicting explicit length units, temperature scales, or quantities attached to those units. A detected conflict triggers a fresh answer. Exact hits still use the original prompt as their key.

`GET /api/v1/health` checks the API process. `GET /api/v1/ready` checks database connectivity and schema setup. Cache entries are shared by all callers, so use this prototype as a single-user local service. Expired rows are skipped at lookup and overwritten when the same prompt is regenerated. To reclaim expired rows, run `DELETE FROM cache_entries WHERE expires_at <= now();`.

## Evaluate semantic matches

With PostgreSQL and Ollama running and the database migration applied, run `npm run evaluate`. The evaluation compares 16 labeled prompt pairs using the configured embedding model and pgvector cosine similarity. It reports each prediction and compares precision and recall across several thresholds, both with similarity alone and with the unit check enabled.

A **false hit** would reuse an answer for a different question. A **false miss** would generate an unnecessary answer for a paraphrase. The evaluator scores each pair independently, reads the configured threshold, and leaves the cache and settings untouched. It does not run the generation model. Add labeled examples in `evaluation/pairs.js` to cover more of your intended usage before tuning the threshold.

After choosing a threshold on the development pairs, run `npm run evaluate:holdout` to test it on 10 separate examples that include changed dates, negation, and different output requirements. The holdout command reports results at the current threshold only.

## Deploy a public demo

Use the repository's `render.yaml` as a [Render Blueprint](https://render.com/docs/infrastructure-as-code). It creates a free Node web service and a free PostgreSQL database. Render applies the schema on startup. The free database expires after 30 days, and free web services can take time to wake up. Provision a fresh database for the demo so local cache data stays on your machine.

In Render, set `GEMINI_API_KEY` to a key from a [Gemini free-tier project](https://aistudio.google.com/api-keys) with billing disabled. Set `PUBLIC_PROXY_SECRET` to a random secret of at least 32 characters. Generate one in PowerShell with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Paste it directly into the hosts' secret settings and keep it out of commits and screenshots.

Import the same repository as a [Vercel Hobby project](https://vercel.com/docs/plans/hobby). In its production environment, set `RENDER_BACKEND_URL` to the web service's HTTPS `onrender.com` URL and set `PUBLIC_PROXY_SECRET` to the same value used on Render. The repository's `vercel.json` supplies the build and routing settings.

Open the Vercel URL, run the playground demo, and check Stats. Confirm that the direct Render query endpoint refuses requests and that repeating a question in a separate private browser window starts with a fresh cache.

The public API scopes cached answers to a signed browser session, limits requests to 12 per visitor and 60 across the demo per UTC day by default, and only accepts cache requests through the Vercel proxy. Hosted cache entries expire after at most 15 minutes and are pruned while Render is running. The hosted configuration starts at a conservative `0.98` threshold. Gemini scores differ from Ollama scores, so run the evaluator with the same model settings and a local pgvector database before tuning this value. A paraphrase still has to pass the threshold, including in the demo.
