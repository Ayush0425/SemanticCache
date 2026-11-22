import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import proxy from "../api/proxy.js";

test("the public proxy verifies origin and keeps caller-supplied scope headers out of the backend", async (context) => {
    process.env.RENDER_BACKEND_URL = "https://semanticcache-test.onrender.com";
    process.env.PUBLIC_PROXY_SECRET = randomBytes(32).toString("hex");
    const forwarded = [];
    context.mock.method(globalThis, "fetch", async (url, options) => {
        forwarded.push({ url, options });
        return Response.json({ success: true });
    });

    const frontend = "https://demo.example";
    const query = (url, headers = {}) => new Request(frontend + url, {
        method: "POST",
        body: JSON.stringify({ prompt: "A sample question" }),
        headers: {
            origin: frontend,
            "content-type": "application/json",
            "x-semanticcache-proxy": "untrusted",
            "x-semanticcache-visitor": "untrusted",
            ...headers,
        },
    });
    assert.equal((await proxy.fetch(query("/api/v1/query", { origin: "https://other.example" }))).status, 403);
    assert.equal((await proxy.fetch(query("/api/v1/unknown"))).status, 404);
    assert.equal(forwarded.length, 0);

    const first = await proxy.fetch(query("/api/v1/query"));
    assert.equal(first.status, 200);
    const cookie = first.headers.get("set-cookie");
    assert.match(cookie, /^__Host-semanticcache=.+; Path=\/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict$/);
    const visitor = forwarded[0].options.headers["x-semanticcache-visitor"];
    assert.equal(forwarded[0].url.toString(), "https://semanticcache-test.onrender.com/api/v1/query");
    assert.equal(forwarded[0].options.headers["x-semanticcache-proxy"], process.env.PUBLIC_PROXY_SECRET);
    assert.notEqual(visitor, "untrusted");

    const repeat = await proxy.fetch(query("/api/proxy?endpoint=query", { cookie: cookie.split(";")[0] }));
    assert.equal(repeat.headers.get("set-cookie"), null);
    assert.equal(forwarded[1].options.headers["x-semanticcache-visitor"], visitor);

    const tampered = cookie.split(";")[0].replace(/\.[A-Za-z0-9_-]+$/, ".0000000000000000000000000000000000000000000");
    await proxy.fetch(query("/api/v1/query", { cookie: tampered }));
    assert.notEqual(forwarded[2].options.headers["x-semanticcache-visitor"], visitor);

    const token = `${visitor}.${(Date.now() - 25 * 60 * 60 * 1_000).toString(36)}`;
    const expiredSignature = createHmac("sha256", process.env.PUBLIC_PROXY_SECRET)
        .update(`visitor:${token}`).digest("base64url");
    await proxy.fetch(query("/api/v1/query", { cookie: `__Host-semanticcache=${token}.${expiredSignature}` }));
    assert.notEqual(forwarded[3].options.headers["x-semanticcache-visitor"], visitor);

    process.env.RENDER_BACKEND_URL = "https://external.example";
    assert.equal((await proxy.fetch(query("/api/v1/query"))).status, 503);
    assert.equal(forwarded.length, 4);
});
