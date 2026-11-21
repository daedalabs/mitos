# Mitos Development & Release Guide

## Setup & Prerequisites
- Node.js $\ge 20$
- npm $\ge 10$

```bash
git clone https://github.com/daedalabs/mitos.git
cd mitos
npm install
```

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run build` | `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production` | Typechecks and creates `main.js` and `styles.css` bundle |
| `npm run dev` | `node esbuild.config.mjs` | Watches files and rebuilds `main.js` continuously on change |
| `npm test` | `vitest run` | Runs unit test suite under Node with mocked Obsidian APIs |
| `npm run dev:vault` | `node scripts/dev-vault.mjs` | Scaffolds a ready-to-test Obsidian vault in `test-vault/` |

---

## Continuous Integration & Release

### GitHub Actions CI (`.github/workflows/ci.yml`)
Runs on every push to `main` and pull requests:
1. `npm ci`
2. `npm run build`
3. `npm test`

### GitHub Releases (`.github/workflows/release.yml`)
Triggers automatically on tag push (`v*`):
1. Runs full build and test verification.
2. Creates a GitHub Release.
3. Automatically attaches `main.js`, `manifest.json`, and `styles.css` to the release assets.
