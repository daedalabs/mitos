# Contributing to Mitos

Thank you for your interest in contributing to **Mitos**!

## Contributor Agreement

By submitting any pull request, patch, bug fix, feature, documentation, or other modification ("Contribution") to this repository or to DaedaLabs, you agree that your contribution is governed by the terms of the [Mitos Source-Available Software License](LICENSE), specifically **Section 5 (Contributions and Pull Requests)**:

- You warrant that your contribution is your original creation and that you hold all necessary legal rights to convey it.
- You grant Deogenes Maranan / DaedaLabs a perpetual, irrevocable, worldwide, royalty-free, transferable, assignable, and fully sublicensable license to use, modify, merge, compile, reproduce, publish, relicense, commercialize, or archive your contribution under current or any future proprietary, open-source, or commercial terms, without restriction or compensation.
- This ensures DaedaLabs retains the ongoing authority to maintain, update, protect, or archive the project without administrative or copyright fragmentation.

---

## Submitting Pull Requests

1. **Open an Issue First:** For major features or architectural shifts, please open an issue to discuss your proposal before investing substantial implementation time.
2. **Quality & Tests:** Ensure your changes do not break existing test suites (`npm test`) and pass typecheck (`npm run typecheck`).
3. **Clean Architecture:** Keep `src/core/*` strictly headless with zero `obsidian` imports. Any Obsidian-specific behavior must be injected via interfaces.
4. **Keep Commits Clean:** Write concise, descriptive commit messages.

---

## Development Commands

```bash
# Install dependencies
npm install

# Run TypeScript typechecker
npm run typecheck

# Run unit test suite (Vitest under Node)
npm test

# Build production bundle (main.js and styles.css)
npm run build

# Start dev watch rebuild
npm run dev

# Scaffold local test vault
npm run dev:vault
```
