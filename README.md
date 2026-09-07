# Teresa Lynn Melton — Memorial Site

A simple two-section memorial website: **Tributes** and **Gallery**.

## Adding photos to the gallery

1. Drop your photo files (`.jpg`, `.jpeg`, `.png`, `.webp`, or `.gif`) into the `images/` folder.
2. Run:
   ```
   node scripts/build-gallery.js
   ```
3. Refresh `index.html` in your browser — the rotating gallery picks up every photo in the folder automatically, in filename order (e.g. `01-beach.jpg`, `02-bike.jpg`, ... helps control ordering).

No build tools or server required — just open `index.html` directly in a browser.
