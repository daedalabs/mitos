# AI Rule: Testing Patterns & Seams

## 1. Headless Testing with Vitest
- Unit tests run under Node via Vitest (`npm test`).
- Obsidian typings and APIs are mocked in `test/mocks/obsidian.ts`.
- Pure business logic (`anti_slop`, `dates`, `notes`, `parse`, `memory`) has zero DOM dependencies.

## 2. Injected Vault & Transactional Rollbacks
- When testing note creation or series writes, pass a mock `VaultLike` instance.
- Test rollback behavior: if write operation $K$ fails in an $N$-file transaction, verify that all previous $K-1$ files are deleted and no dangling files remain.

## 3. Mock Provider Assertions
- Do not make live LLM network calls during automated tests.
- Test against deterministic JSON fixtures.
- Verify retry behavior (429 rate limit triggers 1 retry with backoff).
- Verify header composition (`x-goog-api-key` header presence).
