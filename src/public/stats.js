const statsPanel = document.getElementById("stats");
const playground = document.getElementById("playground");
const statsLink = document.getElementById("stats-link");
const playgroundLink = document.getElementById("playground-link");
const refreshButton = document.getElementById("refresh-stats");
const status = document.getElementById("stats-status");
const data = document.getElementById("stats-data");
const counts = new Intl.NumberFormat("en");
const rates = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
const labels = {
    exact: "Exact hit",
    semantic: "Semantic hit",
    miss: "Miss",
    rejected: "Match rejected",
};

function formatTime(value) {
    return value === null ? "—" : `${counts.format(value)} ms`;
}

function renderStats(stats) {
    document.getElementById("total-requests").textContent = counts.format(stats.totalRequests);
    document.getElementById("generation-skipped").textContent = counts.format(stats.generationCallsSkipped);
    document.getElementById("hit-rate").textContent = stats.hitRate === null ? "—" : rates.format(stats.hitRate);
    const rows = stats.breakdown.map(({ outcome, requests, medianMs, p95Ms }) => {
        const row = document.createElement("tr");
        const label = document.createElement("th");
        label.scope = "row";
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.dataset.cache = outcome;
        badge.textContent = labels[outcome];
        label.append(badge);
        row.append(label);
        for (const value of [counts.format(requests), formatTime(medianMs), formatTime(p95Ms)]) {
            row.insertCell().textContent = value;
        }
        return row;
    });
    document.getElementById("stats-breakdown").replaceChildren(...rows);
    data.hidden = false;
}

async function loadStats() {
    if (refreshButton.disabled) return;
    refreshButton.disabled = true;
    status.textContent = "Loading cache stats…";
    status.hidden = false;
    delete status.dataset.type;
    try {
        const response = await fetch("/api/v1/stats", { signal: AbortSignal.timeout(90_000) });
        const stats = await response.json().catch(() => null);
        if (!response.ok || !stats?.success) {
            throw new Error(stats?.message ?? `Could not load stats (HTTP ${response.status}).`);
        }
        renderStats(stats);
        status.hidden = true;
    } catch (error) {
        status.textContent = error.name === "TypeError" || error.name === "TimeoutError"
            ? "Could not reach the stats endpoint. Try refreshing."
            : error.message;
        status.dataset.type = "error";
    } finally {
        refreshButton.disabled = false;
    }
}

function showView() {
    const isStats = location.hash === "#stats";
    statsPanel.hidden = !isStats;
    playground.hidden = isStats;
    statsLink.removeAttribute("aria-current");
    playgroundLink.removeAttribute("aria-current");
    const current = isStats ? statsLink : playgroundLink;
    current.setAttribute("aria-current", "page");
    document.title = isStats ? "Stats · SemanticCache" : "Playground · SemanticCache";
    if (isStats) loadStats();
}

refreshButton.addEventListener("click", loadStats);
window.addEventListener("hashchange", showView);
showView();
