// Vercel serverless function: per-photo comments stored as comments.json in
// this GitHub repo. Reads go straight to GitHub (always fresh); writes append
// a comment and commit the file back via the GitHub Contents API.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   GITHUB_TOKEN    fine-grained token with "Contents: Read and write" on this repo (required)
//   GITHUB_REPO     owner/name, defaults to Akshit-Panapuzha/Teresa-Lynn-Melton
//   GITHUB_BRANCH   defaults to main
//   COMMENTS_PATH   defaults to comments.json

const REPO = process.env.GITHUB_REPO || "Akshit-Panapuzha/Teresa-Lynn-Melton";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = process.env.COMMENTS_PATH || "comments.json";
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

const MAX_NAME = 60;
const MAX_MESSAGE = 1000;
const PHOTO_PATTERN = /^[A-Za-z0-9_\-./ ]+\.(jpe?g|png|webp|gif)$/i;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_POSTS = 5;

// Best-effort per-instance rate limiting (serverless instances are ephemeral,
// so this is a speed bump for bots, not a guarantee).
const recentPosts = new Map();

function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "teresa-memorial-comments",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readComments() {
  const res = await fetch(`${API_URL}?ref=${encodeURIComponent(BRANCH)}`, {
    headers: githubHeaders(),
  });
  if (res.status === 404) return { comments: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = Buffer.from(data.content, "base64").toString("utf8");
  let comments = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) comments = parsed;
  } catch {
    comments = [];
  }
  return { comments, sha: data.sha };
}

async function writeComments(comments, sha, commitMessage) {
  const body = {
    message: commitMessage,
    content: Buffer.from(JSON.stringify(comments, null, 2) + "\n").toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(API_URL, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) return false; // sha conflict → retry
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  return true;
}

function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const times = (recentPosts.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX_POSTS) return true;
  times.push(now);
  recentPosts.set(ip, times);
  return false;
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.GITHUB_TOKEN) {
    return res.status(503).json({ error: "Comments are not configured yet (missing GITHUB_TOKEN)." });
  }

  if (req.method === "GET") {
    try {
      const { comments } = await readComments();
      const photo = req.query && req.query.photo;
      const result = photo ? comments.filter((c) => c.photo === photo) : comments;
      return res.status(200).json({ comments: result });
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "Could not load comments right now." });
    }
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    if (!body) return res.status(400).json({ error: "Invalid request body." });

    // Honeypot: real users never see or fill this field.
    if (clean(body.website, 10)) return res.status(200).json({ ok: true });

    const photo = clean(body.photo, 200);
    const name = clean(body.name, MAX_NAME);
    const message = clean(body.message, MAX_MESSAGE);

    if (!PHOTO_PATTERN.test(photo) || photo.includes("..")) {
      return res.status(400).json({ error: "Unknown photo." });
    }
    if (!name) return res.status(400).json({ error: "Please add your name." });
    if (message.length < 2) return res.status(400).json({ error: "Please write a message." });

    if (rateLimited(clientIp(req))) {
      return res.status(429).json({ error: "Too many comments at once — please try again in a few minutes." });
    }

    const comment = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      photo,
      name,
      message,
      date: new Date().toISOString(),
    };

    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { comments, sha } = await readComments();
        comments.push(comment);
        const ok = await writeComments(comments, sha, `Add comment from ${name} on ${photo}`);
        if (ok) return res.status(201).json({ ok: true, comment });
      }
      return res.status(503).json({ error: "The site was busy — please try posting again." });
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "Could not save your comment right now." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
