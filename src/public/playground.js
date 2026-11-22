const byId = (id) => document.getElementById(id);
const form = byId("query-form");
const promptInput = byId("prompt");
const demoButton = byId("demo");
const sendButton = byId("submit-query");
const clearButton = byId("clear");
const feedback = byId("feedback");
const historyList = byId("request-list");
const requests = [];
const countFormat = new Intl.NumberFormat("en");
const scoreFormat = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 2 });
const labels = { miss: "Miss", exact: "Exact hit", semantic: "Semantic hit", rejected: "Match rejected" };
const summaries = {
    miss: "Ollama generated a new answer.",
    exact: "The cache found the same prompt and skipped both model calls.",
    semantic: "The cache matched a similar prompt and skipped generation.",
    rejected: "The unit check rejected a similar prompt. Ollama generated a fresh answer.",
};
const demoSteps = [
    ["Original question", "What causes the sky to look blue during the day?"],
    ["Exact repeat", "What causes the sky to look blue during the day?"],
    ["Reworded question", "What causes the sky to appear blue during the day?"],
];
let busy = false;

function setBusy(value) {
    busy = value;
    promptInput.readOnly = value;
    sendButton.disabled = value;
    demoButton.disabled = value;
    clearButton.disabled = value || !requests.length;
}

function showFeedback(message, type = "") {
    feedback.textContent = message;
    feedback.dataset.type = type;
    feedback.hidden = !message;
}

function setCounter() {
    byId("counter").textContent = `${countFormat.format(promptInput.value.length)} / 2,000`;
}

function setBadge(badge, cache) {
    badge.textContent = labels[cache];
    badge.dataset.cache = cache;
}

function showResult(request) {
    const { answer, cache, duration, similarity, matchedPrompt } = request;
    const badge = byId("result-badge");
    setBadge(badge, cache);
    badge.hidden = false;
    byId("result-summary").textContent = summaries[cache];
    byId("latency").textContent = `${countFormat.format(duration)} ms`;
    byId("similarity-metric").hidden = cache !== "semantic";
    byId("similarity").textContent = cache === "semantic" ? scoreFormat.format(similarity) : "";
    const match = byId("match");
    match.hidden = !matchedPrompt;
    match.textContent = matchedPrompt ? `Matched prompt · ${matchedPrompt}` : "";
    byId("answer").textContent = answer;
    byId("empty-response").hidden = true;
    byId("result").hidden = false;
}

function addRequest(request) {
    requests.unshift(request);
    if (requests.length > 12) requests.pop();
    renderHistory();
}

function renderHistory() {
    const longest = Math.max(1, ...requests.map(({ duration }) => duration));
    const rows = requests.map(({ prompt, cache, duration, step }) => {
        const row = document.createElement("li");
        const question = document.createElement("span");
        question.className = "history-prompt";
        const text = document.createElement("span");
        text.textContent = prompt;
        question.append(text);
        if (step) {
            const label = document.createElement("small");
            label.textContent = step;
            question.prepend(label);
        }

        const badge = document.createElement("span");
        badge.className = "badge";
        setBadge(badge, cache);

        const time = document.createElement("span");
        time.className = "history-time";
        time.textContent = `${countFormat.format(duration)} ms`;
        const track = document.createElement("span");
        track.className = "track";
        track.setAttribute("aria-hidden", "true");
        const bar = document.createElement("span");
        bar.dataset.cache = cache;
        bar.style.width = `${duration / longest * 100}%`;
        track.append(bar);

        row.append(question, badge, track, time);
        return row;
    });
    historyList.replaceChildren(...rows);
    historyList.hidden = !rows.length;
    byId("history-empty").hidden = Boolean(rows.length);
    clearButton.disabled = busy || !rows.length;
}

async function requestAnswer(prompt, demoRunId, step) {
    const started = performance.now();
    let response;
    try {
        response = await fetch("/api/v1/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, demoRunId }),
            signal: AbortSignal.timeout(250_000),
        });
    } catch (error) {
        throw new Error(error.name === "TimeoutError" ? "The request timed out. Try again." : "Could not reach the API. Check that SemanticCache is running.");
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !Object.hasOwn(labels, result.cache)) {
        throw new Error(result?.message ?? `Unexpected API response (HTTP ${response.status}).`);
    }
    const request = {
        ...result,
        cache: result.semanticRejected ? "rejected" : result.cache,
        prompt,
        step,
        duration: Math.round(performance.now() - started),
    };
    showResult(request);
    addRequest(request);
    return request;
}

async function runQueries(steps, demoRunId) {
    if (busy) return;
    setBusy(true);
    try {
        for (const [step, prompt] of steps) {
            showFeedback(step ? `Running demo · ${step}` : "Waiting for a response…");
            await requestAnswer(prompt, demoRunId, step);
        }
        showFeedback(demoRunId ? "Demo complete. Compare the three requests below." : "");
    } catch (error) {
        showFeedback(error.message, "error");
        updateConnection();
    } finally {
        setBusy(false);
    }
}

async function updateConnection() {
    const connection = byId("connection");
    const ready = await fetch("/api/v1/ready", {
        signal: AbortSignal.timeout(7_000),
    }).then((res) => res.ok, () => false);
    connection.textContent = ready ? "Database ready" : "Database unavailable";
    connection.dataset.ready = String(ready);
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showFeedback("Enter a prompt before sending.", "error");
        promptInput.focus();
        return;
    }
    runQueries([[null, prompt]]);
});
promptInput.addEventListener("input", setCounter);
demoButton.addEventListener("click", () => runQueries(demoSteps, crypto.randomUUID()));
clearButton.addEventListener("click", () => {
    requests.length = 0;
    renderHistory();
});
updateConnection();
