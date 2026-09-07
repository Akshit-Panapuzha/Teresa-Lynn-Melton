// Exercises api/comments.js locally against a fake GitHub Contents API.
// No network, no token needed:  node scripts/test-comments-api.js
import assert from "node:assert/strict";

// Deliberately padded with the kind of stray whitespace a dashboard paste
// introduces — a tab in GITHUB_BRANCH once broke production. The assertions
// below check these are trimmed before they reach GitHub.
process.env.GITHUB_TOKEN = " test-token\n";
process.env.GITHUB_REPO = "  example/repo  ";
process.env.GITHUB_BRANCH = "\tmain";
process.env.COMMENTS_PATH = " comments.json ";

const { default: handler } = await import("../api/comments.js");

// ---- fake GitHub: an in-memory file with sha-based conflict detection ----
const store = { content: "[]\n", sha: "sha-0", version: 0 };
let failNextWrite = false;

globalThis.fetch = async (url, options = {}) => {
  const method = options.method || "GET";
  assert.ok(String(url).startsWith("https://api.github.com/repos/example/repo/contents/comments.json"));
  assert.equal(options.headers.Authorization, "Bearer test-token");

  if (method === "GET") {
    return new Response(
      JSON.stringify({ sha: store.sha, content: Buffer.from(store.content).toString("base64") }),
      { status: 200 }
    );
  }
  if (method === "PUT") {
    const body = JSON.parse(options.body);
    assert.equal(body.branch, "main", "branch must be trimmed before it reaches GitHub");
    if (failNextWrite || body.sha !== store.sha) {
      failNextWrite = false;
      return new Response("conflict", { status: 409 });
    }
    store.content = Buffer.from(body.content, "base64").toString("utf8");
    store.version += 1;
    store.sha = `sha-${store.version}`;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  throw new Error(`unexpected ${method}`);
};

// ---- minimal req/res shims matching what Vercel provides ----
function makeReq({ method = "GET", query = {}, body, ip = "1.2.3.4" } = {}) {
  return { method, query, body, headers: { "x-forwarded-for": ip } };
}
function makeRes() {
  const res = { statusCode: 200, headers: {}, body: null };
  res.setHeader = (k, v) => (res.headers[k] = v);
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (obj) => ((res.body = obj), res);
  return res;
}
async function call(reqOpts) {
  const res = makeRes();
  await handler(makeReq(reqOpts), res);
  return res;
}

// 1. Empty read
let r = await call({ method: "GET" });
assert.equal(r.statusCode, 200);
assert.deepEqual(r.body.comments, []);
assert.equal(r.headers["Cache-Control"], "no-store");

// 2. Post a comment → committed to the fake repo
r = await call({
  method: "POST",
  body: { photo: "gallery-photos/03-page03.jpg", name: "  Patty  ", message: "I remember this day so well." },
});
assert.equal(r.statusCode, 201, JSON.stringify(r.body));
assert.equal(r.body.comment.name, "Patty");
assert.equal(store.version, 1);
const saved = JSON.parse(store.content);
assert.equal(saved.length, 1);
assert.equal(saved[0].photo, "gallery-photos/03-page03.jpg");
assert.ok(saved[0].id && saved[0].date);

// 3. Read filtered by photo
r = await call({ method: "GET", query: { photo: "gallery-photos/03-page03.jpg" } });
assert.equal(r.body.comments.length, 1);
r = await call({ method: "GET", query: { photo: "gallery-photos/04-page04.jpg" } });
assert.equal(r.body.comments.length, 0);

// 4. Body arrives as a JSON string (some clients) — still works
r = await call({
  method: "POST",
  body: JSON.stringify({ photo: "Profile-Image-Teri-Melton.jpg", name: "Bill", message: "Miss you, sis." }),
});
assert.equal(r.statusCode, 201);
assert.equal(JSON.parse(store.content).length, 2);

// 5. Write conflict is retried and succeeds
failNextWrite = true;
r = await call({ method: "POST", body: { photo: "gallery-photos/10-page10.jpg", name: "Jim", message: "Beautiful smile." } });
assert.equal(r.statusCode, 201);
assert.equal(JSON.parse(store.content).length, 3);

// 6. Validation
r = await call({ method: "POST", body: { photo: "../secrets.jpg", name: "x", message: "hello" } });
assert.equal(r.statusCode, 400);
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "", message: "hello" } });
assert.equal(r.statusCode, 400);
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "Bot", message: "" } });
assert.equal(r.statusCode, 400);
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "Bot", message: "buy now", website: "http://spam" } });
assert.equal(r.statusCode, 200); // honeypot: pretend success, save nothing
assert.equal(JSON.parse(store.content).length, 3);

// 7. Long input is trimmed, not rejected
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "N".repeat(200), message: "M".repeat(5000) } });
assert.equal(r.statusCode, 201);
assert.equal(r.body.comment.name.length, 60);
assert.equal(r.body.comment.message.length, 1000);

// 8. Rate limit kicks in after 5 posts from one IP within the window (4 so far)
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "A", message: "five" } });
assert.equal(r.statusCode, 201);
r = await call({ method: "POST", body: { photo: "gallery-photos/01-page01.jpg", name: "A", message: "six" } });
assert.equal(r.statusCode, 429);
r = await call({ method: "POST", ip: "9.9.9.9", body: { photo: "gallery-photos/01-page01.jpg", name: "B", message: "other ip" } });
assert.equal(r.statusCode, 201);

// 9. Method handling + missing token
r = await call({ method: "DELETE" });
assert.equal(r.statusCode, 405);
delete process.env.GITHUB_TOKEN;
r = await call({ method: "GET" });
assert.equal(r.statusCode, 503);

console.log("All comments API tests passed.");
