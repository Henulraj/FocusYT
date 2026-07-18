# FocusYT

A distraction-free YouTube research app. One video at a time, folders of
clips, one shared note per folder, no feed, no autoplay rabbit hole.


![Screenshot](/s1.png)

![Screenshot](/s3.png)

![Screenshot](/s2.png)

## What's working out of the box

- Home screen: recent folders + search
- Search results via bundled `yt-dlp` (no YouTube API key, no quota)
- Research view: embedded player, folder sidebar, per-folder shared notes
- Timestamp "clip" tagging in notes (reads current playback time via
  YouTube's postMessage API)
- Comments tab (via `yt-dlp --write-comments`)
- SQLite storage, local only, no account/server

## What's NOT wired up yet — read this before assuming it's ad-free

The player currently embeds via `youtube-nocookie.com`. **This reduces
tracking but does not block ads** — confirmed against Google's own 2026
statement on privacy-enhanced mode. Real ad-blocking (the FreeTube-style
approach we agreed on) requires native, per-OS request interception that
can't be done in cross-platform Rust:

- **macOS**: compile `src-tauri/filters/easylist-trimmed.txt` into a
  `WKContentRuleList` and attach it via `WKUserContentController` on the
  window's `WKWebView`. See `src-tauri/src/ad_block.rs` for the exact API
  and doc link — the domain list is already parsed and ready, this is the
  remaining step.
- **Windows**: subscribe to `ICoreWebView2.WebResourceRequested` on the
  window's WebView2 controller and cancel requests matching the same
  domain list.

Both require calling into the native webview handle that
`WebviewWindow::with_webview` exposes — this is Swift/Objective-C glue on
macOS and COM calls on Windows, outside what a cross-platform scaffold can
safely guess at without your target OS in front of me. Happy to build
either one next if you tell me which platform to prioritize.

## Setup

1. Install Rust: https://rustup.rs
2. Install Node.js (for the Tauri CLI)
3. Install the Tauri CLI:
   ```
   npm install
   ```
4. Download the `yt-dlp` binary for your platform and place it at:
   - `src-tauri/binaries/yt-dlp` (macOS/Linux)
   - `src-tauri/binaries/yt-dlp.exe` (Windows)

   Get it from https://github.com/yt-dlp/yt-dlp/releases — grab the
   standalone binary (not the pip package), rename it to match Tauri's
   sidecar naming convention (`yt-dlp-x86_64-apple-darwin` etc. — see
   https://tauri.app/develop/sidecar/ for the exact per-target suffix
   Tauri expects).
5. Run in development:
   ```
   npm run dev
   ```
6. Build installers (.dmg for Mac, .msi/.nsis for Windows):
   ```
   npm run build
   ```

## Known rough edges to expect on first run

- First folder/video flow when clicking a search result but not yet inside
  a folder uses a plain `prompt()` dialog — functional, not polished. Your
  original mockup shows a proper dropdown for this; happy to build that
  next.
- "Related / Similar" videos sections from the mockup are intentionally
  left out per your last instructions.
- Transcript tab intentionally left out per your last instructions.

