# Halloween postit assets

Current production candidates:
- `halloween-paper-square.png`: square paper, 1254×1254, SHA-256 `a831c94915e7640266095be03dcf1c9dce0652681d58831e866581bdeb1dbdf6`.
- `halloween-preview-fullbleed.png`: opaque square preview, 1254×1254, 2080880 bytes, SHA-256 `c55cdbaab4e1a476145a5a5e8e14664bf9606b16c481e9fe4963077325206ca5`.

Both use design ID `halloween-ghost`. Both files were uploaded to shared Storage and registered with grants disabled on 2026-10-30. See [server verification](../../docs/events/2026-10-30-postit-design-server.md). Paper and preview must be square, 512–2048 px per side, 8-bit RGB/RGBA, non-interlaced, at most 2 MiB each. Recommended artwork size: 1254×1254. Preview must be opaque to every edge, without transparent padding or an outer circle. Keep important features inside the central inscribed circle. The app clips the image to a circle without zooming.

The user-provided `halloween-paper.png` (portrait) and `halloween-preview.png` (transparent circle) remain unchanged as source references. `halloween-paper-landscape.png` is an earlier discarded composition, not a valid registration candidate under the final square-only specification.

Generation: built-in imagegen. Square paper prompt: Recompose the original lavender watercolor paper as a square, preserving small corner ghosts, crescent, stars and scalloped border with a broad pale empty writing center; no text or UI.

Final preview prompt: Preserve the cute cream-white ghost, pink cheeks, violet crescent and composition. Fill the entire square including corners with an opaque lavender watercolor wash; no transparent padding, circular frame, text or UI. Keep important features inside the inscribed circle. Simplify noisy paper grain into a soft watercolor wash for a lightweight 40 px thumbnail.
