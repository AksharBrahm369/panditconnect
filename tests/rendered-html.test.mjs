import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Pandit in Minutes landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Pandit in Minutes/);
  assert.match(html, /trusted Pandit/i);
  assert.match(html, /Book a Pandit/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("renders the OTP login entry point", async () => {
  const response = await render("/login?role=customer");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Continue with mobile/);
  assert.match(html, /Customer/);
  assert.match(html, /Pandit/);
});
