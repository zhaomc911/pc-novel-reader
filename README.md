# PC Novel Reader

PC Novel Reader is a calm, ad-free desktop novel reader for local TXT books.

It is designed for people who want a clean personal reading space: import your own novels, keep them in a local bookshelf, and read without ads, feeds, recommendations, or distractions.

## Download

Pre-release builds are available on the Releases page:

[Download PC Novel Reader](https://github.com/zhaomc911/pc-novel-reader/releases)

Current builds target:

- macOS
- Windows

Because the app is not code-signed yet, your system may show a security warning the first time you open it. On macOS, right-click the app and choose `Open`. On Windows, SmartScreen may require manual confirmation.

## Features

- Import local TXT novels
- Automatically detect chapter headings
- Clean noisy chapter-title notes such as update messages or author side notes
- Keep a local bookshelf
- Remember reading progress
- Separate library and reading views
- Collapsible chapter list for focused reading
- Desktop packaging powered by Tauri

## Privacy

PC Novel Reader is local-first.

- Imported books are stored on your own computer.
- Reading data stays in local browser/app storage.
- The app does not require an account.
- The app does not include ads or remote recommendation feeds.

## Development

Requirements:

- Node.js
- pnpm
- Rust toolchain

Install dependencies:

```bash
pnpm install
```

Run the web development server:

```bash
pnpm dev
```

Run the desktop app in development mode:

```bash
pnpm tauri:dev
```

Build the frontend:

```bash
pnpm build
```

Build a macOS `.app` bundle:

```bash
pnpm tauri:build:mac-app
```

Build desktop bundles for the current platform:

```bash
pnpm tauri:build
```

Build outputs are written to:

```bash
src-tauri/target/release/bundle
```

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Tauri 2
- localForage

## Release

This repository includes a GitHub Actions workflow for beta builds:

```bash
.github/workflows/desktop-build.yml
```

Pushing a version tag creates a pre-release and uploads desktop build assets:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## License

No license has been selected yet.
