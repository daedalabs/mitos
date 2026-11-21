# AI Rule: Data Contracts & Note Generation

## 1. Safe YAML Serialization
Never use naive string interpolation when generating frontmatter:
- All strings must pass through `yamlStr(val)` (`JSON.stringify(String(val))`).
- Quotes, colons, and newlines in hooks must not break YAML parsing.

## 2. Publish Dates & ISO Standards
- `publish_date` must always be formatted as ISO `YYYY-MM-DD`.
- Do not quote `publish_date` in frontmatter so Obsidian Dataview recognizes it natively as a `date` type.

## 3. Series Arc Closed Wikilink Integrity
When writing multi-part series:
- Episode 1 has `prev: ""` and `next: "[[Ep 2]]"`.
- Episode 2 has `prev: "[[Ep 1]]"` and `next: "[[Ep 3]]"`.
- Episode $N$ has `prev: "[[Ep N-1]]"` and `next: ""`.
- The index note in `content/series/{series-id}.md` links to all episodes. If the filename is collision-suffixed, `series_id` must use the resolved id.
- Episodes 2..$N$ must render `payoff_from_prev` under a `## Payoff from Previous Episode` section.
- Model hooks across episodes must maintain token Jaccard similarity $< 0.7$ to prevent repetitive hooks.

## 4. Collision Defense
- Check if file exists before writing.
- On collision, resolve via suffix `-2`, `-3`, etc.
- Never blindly overwrite an existing note.
