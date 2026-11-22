import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const methods = { health: "GET", ready: "GET", stats: "GET", query: "POST" };
const cookieName = "__Host-semanticcache";
const cookieLifetimeSeconds = 86_400;

function signature(secret, token) {
    return createHmac("sha256", secret).update(`visitor:${token}`).digest("base64url");
}

function visitorFromCookie(cookie, secret) {
    const match = cookie.match(/(?:^|;\s*)__Host-semanticcache=([a-f0-9-]{36})\.([0-9a-z]{1,12})\.([a-zA-Z0-9_-]{43})(?:;|$)/);
    if (!match) return null;
    const [, id, issuedAt, provided] = match;
    const ageMs = Date.now() - Number.parseInt(issuedAt, 36);
    if (ageMs < 0 || ageMs >= cookieLifetimeSeconds * 1_000) return null;
    const expected = signature(secret, `${id}.${issuedAt}`);
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected)) ? id : null;
}

function failure(status, message) {
    return Response.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const endpoint = url.pathname.match(/^\/api\/v1\/([a-z]+)$/)?.[1]
            ?? url.searchParams.get("endpoint");
        if (!Object.hasOwn(methods, endpoint)) return failure(404, "API route not found.");
        if (request.method !== methods[endpoint]) return failure(405, "Method not allowed.");

        const backend = process.env.RENDER_BACKEND_URL;
        const secret = process.env.PUBLIC_PROXY_SECRET;
        if (!backend || !secret || secret.length < 32) return failure(503, "The public demo has not been configured.");

        const query = endpoint === "query";
        const origin = request.headers.get("origin");
        if (query && origin && origin !== url.origin) return failure(403, "Open the demo to send prompts.");
        if (query && !/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
            return failure(415, "Send queries as JSON.");
        }

        const savedVisitor = visitorFromCookie(request.headers.get("cookie") ?? "", secret);
        const visitor = savedVisitor ?? randomUUID();
        try {
            const body = query ? await request.text() : undefined;
            if (body && Buffer.byteLength(body) > 16_384) return failure(413, "The request is too large.");
            const target = new URL(`/api/v1/${endpoint}`, backend);
            if (target.protocol !== "https:" || !target.hostname.endsWith(".onrender.com")
                || target.port || target.username || target.password) {
                return failure(503, "The public demo backend requires its HTTPS onrender.com URL.");
            }

            const upstream = await fetch(target, {
                method: request.method,
                body,
                headers: {
                    "content-type": "application/json",
                    "x-semanticcache-proxy": secret,
                    "x-semanticcache-visitor": visitor,
                },
                redirect: "error",
                signal: AbortSignal.timeout(140_000),
            });
            const contentType = upstream.headers.get("content-type") ?? "";
            if (!contentType.startsWith("application/json")) {
                return failure(503, "The server is waking up. Try again shortly.");
            }
            const headers = new Headers({ "Content-Type": contentType, "Cache-Control": "no-store" });
            if (query && !savedVisitor) {
                const token = `${visitor}.${Date.now().toString(36)}`;
                headers.set("Set-Cookie", `${cookieName}=${token}.${signature(secret, token)}; Path=/; Max-Age=${cookieLifetimeSeconds}; HttpOnly; Secure; SameSite=Strict`);
            }
            return new Response(upstream.body, { status: upstream.status, headers });
        } catch (error) {
            return failure(503, error.name === "TimeoutError"
                ? "The server took too long to respond. Try again shortly."
                : "The server is temporarily unavailable.");
        }
    },
};
