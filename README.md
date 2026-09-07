# Teresa Lynn Melton — Memorial Site

A two-section memorial website — **Tributes** and a rotating photo **Gallery** — with a
comment box under each photo so family and friends can share memories.

No framework, no build step, no database: plain HTML/CSS/JS, one Vercel serverless
function, and comments saved as `comments.json` in this repository.

## Adding photos to the gallery

1. Drop photo files (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) into `images/` or
   `images/gallery-photos/`. Files with "background" in the name are ignored (they're
   page decoration, not slides).
2. Run:
   ```
   node scripts/build-gallery.js
   ```
3. Commit and push. The slideshow shows photos in filename order (`01-…`, `02-…`).

## Previewing locally

```
python3 scripts/serve.py
```

Then open http://localhost:8843/index.html. Caching is disabled so edits show on
reload. The comment box works locally too, but comments posted here are kept in
memory only and vanish when the server stops.

You can also just double-click `index.html` — everything works except comments,
which need the API and so only appear on the deployed site.

## How comments work

- `api/comments.js` is a Vercel serverless function.
- **Reading**: it fetches `comments.json` from GitHub, so new comments show
  immediately — no redeploy needed.
- **Posting**: it appends the comment to `comments.json` and commits it back to
  the repo through the GitHub API. Every comment is a commit.
- **Moderating**: edit `comments.json` on GitHub and delete the entry. That's it.
- Spam protection: a hidden honeypot field, length limits, and a per-IP rate limit
  (5 posts per 10 minutes).

Each entry looks like:

```json
{
  "id": "m0xq1z-a8b2c3",
  "photo": "gallery-photos/03-page03.jpg",
  "name": "Patty",
  "message": "I remember this day so well.",
  "date": "2026-09-07T22:41:03.512Z"
}
```

Run the API's tests (no network or token needed):

```
node scripts/test-comments-api.js
```

## Deploying to Vercel

1. **Create a GitHub token** for the comments function to commit with:
   GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token.
   - Repository access: **Only select repositories** → this repo
   - Permissions → Repository permissions → **Contents: Read and write**
   - Set an expiry you're comfortable with (you'll need to rotate it when it expires).
2. **Import the repo into Vercel** (vercel.com → Add New → Project → this GitHub repo).
   Framework preset: **Other**. No build command, no output directory changes.
3. **Add environment variables** in the Vercel project (Settings → Environment Variables):
   - `GITHUB_TOKEN` — the token from step 1 (required)
   - `GITHUB_REPO` — `Akshit-Panapuzha/Teresa-Lynn-Melton` (optional, this is the default)
   - `GITHUB_BRANCH` — `main` (optional default)
4. Deploy. The static site works without the token; the comment box appears only
   once the API can reach GitHub.

Never put the token in the repo. `.env.example` lists the variables for reference.
