# AI Rule: Coding Standards & Security

## 1. Zero `innerHTML` Rule (Vault Security)
Under no circumstances should `innerHTML` be used with AI-generated or user-supplied strings:
- Use Obsidian's `createEl()`, `createSpan()`, or `createDiv()`.
- Use `.setText()` or `.createEl('em', { text })` for dynamic content.
- Prevent XSS vulnerabilities within the local Electron environment.

## 2. Native Obsidian CSS Variables Only
Do not hardcode hex, rgb, or hsl color values in CSS or inline styles:
- Use `--text-normal`, `--text-muted`, `--text-warning`, `--text-error`.
- Use `--background-primary`, `--background-secondary`, `--background-modifier-border`.
- Use `--interactive-accent`, `--radius-s`, `--radius-m`.
- Ensure dark and light themes render with perfect contrast.

## 3. Error Taxonomy (`MitosError`)
Never throw bare strings or unhandled standard errors. Always wrap or rethrow as a structured `MitosError`:
```typescript
export class MitosError extends Error {
  kind: 'auth' | 'network' | 'rate_limit' | 'parse' | 'invalid_model' | 'vault' | 'canceled';
  retriable: boolean;
  status?: number;
}
```
The UI maps error kinds directly to actionable instructions for the user.

## 4. API Key Header Security
- Google Gemini API key must be passed via the `x-goog-api-key` header, **never** in the URL query string (`?key=...`).
- OpenAI API key must be passed via the `Authorization: Bearer <key>` header.
