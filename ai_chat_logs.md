# AI Chat Logs – PipelineIQ

This document records the key AI-assisted decisions made during this project, including one moment where I explicitly disagreed with the AI's recommendation.

---

## Session 1 – Architecture Planning

**Me:** I need to build a mini hiring pipeline manager. Candidates move Applied → Screening → Interview → Offer → Hired, and can be rejected at any point. I need an immutable audit trail and smart search. What's the best stack?

**AI (Antigravity):** For a single-recruiter, single-page app with no backend requirement, I recommend:
- **Pure HTML + CSS + Vanilla JS** — zero build tooling, works offline, instant load
- **localStorage** for persistence — satisfies the single-user constraint perfectly
- **Kanban board layout** — columns for each stage, cards for candidates
- **NLP-style query parser** for search + Levenshtein for fuzzy matching

This avoids React/Vue overhead for what is fundamentally a simple CRUD + search problem.

**Me:** Agreed. Let's do it.

---

## Session 2 – Search Engine Design

**Me:** How should I implement the fuzzy search? The recruiter should be able to type "sharam" and find "Priya Sharma."

**AI:** I recommend adding [Fuse.js](https://fusejs.io/) via a CDN `<script>` tag. It handles fuzzy matching, weighting, and ranking out of the box:

```html
<script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"></script>
```

Then configure it:
```js
const fuse = new Fuse(candidates, {
  keys: ['name', 'role'],
  threshold: 0.4,
  includeScore: true,
});
```

**Me:** ❌ I disagree with this recommendation.

Two problems:
1. A CDN dependency means the app breaks if the network is unavailable. This is a static file app designed to work offline.
2. Fuse.js's scoring is opaque — it mixes multiple heuristics (prefix bonuses, tokenization, character-level matching) in ways that are hard to predict or debug.

I'll write a 20-line Levenshtein distance function instead. It gives me full control over scoring, works offline, adds zero dependencies, and is easy to test.

**AI:** That's a valid tradeoff. Levenshtein is well-understood, deterministic, and perfectly adequate for name matching on a small candidate pool (< 1000 records). For a much larger dataset, you might want to consider trigram indexing or Elasticsearch — but for this scale, your custom implementation is the right call.

---

## Session 3 – Immutable Audit Trail

**Me:** How do I ensure history entries are never altered?

**AI:** The key pattern is **append-only array construction**:

```js
// ❌ Never do this — mutates history in-place
c.history.push({ action, timestamp });

// ✅ Always create a new array — the old entries are never touched
c.history = [...c.history, { action, stage, timestamp }];
```

Additionally, never expose a function that can modify an existing history entry. The only public API should be `addHistoryEntry()`, not `editHistoryEntry()`.

Since state is serialized to localStorage as a snapshot, and reads always reconstruct from that snapshot, there's no way for old entries to be mutated at rest.

**Me:** Perfect. I'll also make sure the timestamp is always set at write time (server-side would be better, but `new Date().toISOString()` is fine for a client-only app).

---

## Session 4 – Search Query Parser

**Me:** The search needs to handle things like "stuck in Screening for more than a week" and "moved to Interview since Monday." How do I parse these?

**AI:** I recommend a lightweight **regex-based intent extractor** rather than a full NLP pipeline. For 6-7 distinct query patterns, regex is the right tool:

```js
// "stuck in <stage> for more than <time>"
const stuckMatch = q.match(/stuck\s+in\s+(\w+)|in\s+(\w+)\s+for\s+(?:more\s+than\s+)?(.+)/i);

// "moved to <stage> since <time>"
const movedMatch = q.match(/moved?\s+to\s+(\w+)\s+since\s+(.+)/i);

// Day offset parser for "Monday", "7 days", "a week"
function parseDayOffset(tokens, i) { ... }
```

Errors should be descriptive, not silent empty results. If a stage name is unrecognised, tell the user what valid stages are.

**Me:** Agreed. I'll also add a stage alias map so "screen" matches "Screening", "hire" matches "Hired", etc. The parser should be composable — multiple intents can apply to the same query (e.g., "stuck in Screening for a week, find Priya").

**AI:** Great idea. Separate the intent array from the name query — structural intents are applied as filters, then fuzzy scoring ranks within the filtered pool.

---

## Key Disagreement Summary

| Topic | AI Suggestion | My Decision | Reason |
|---|---|---|---|
| Fuzzy search | Use Fuse.js via CDN | Custom Levenshtein | Offline-safe, no dependency, full control |
| Search results for no match | Show empty list | Show descriptive error message | Better UX per spec requirement |
| State management | Could use IndexedDB for larger data | localStorage | Simpler, sufficient for 1 recruiter |
