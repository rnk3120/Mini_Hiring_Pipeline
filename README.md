# PipelineIQ – Mini Hiring Pipeline Manager

A recruiter-focused hiring pipeline web app built as a single-page, zero-dependency application.  
Candidates move through **Applied → Screening → Interview → Offer → Hired** with full audit trail and smart search.

---

## 🚀 How to Run

No build step required. Open `index.html` directly in any modern browser:

```bash
# Option 1: Just open the file
open index.html   # macOS
start index.html  # Windows

# Option 2: Serve locally (avoids any CORS edge cases)
npx serve .
# or
python -m http.server 3000
```

Navigate to `http://localhost:3000` (or `3000` depending on the server).

> **Requires**: A modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+). No Node.js, no bundler, no dependencies.

---

## 🏗️ Architecture Decisions

### Why Vanilla JS (no framework)?

The project spec is explicitly small: one recruiter, one job, one pipeline board. A framework like React or Vue would add ~100KB of overhead, a build pipeline, and module complexity — all for a problem solvable with ~600 lines of plain JS. The result loads instantly, works offline, and has zero dependency vulnerabilities.

**Trade-off**: For a team > 1 or features like real-time sync, I'd switch to React + a proper state manager.

### State & Persistence: `localStorage`

All state lives in `localStorage` as JSON. This satisfies the single-recruiter constraint perfectly:
- Zero server infrastructure
- Instant reads/writes
- Survives browser restarts

**Trade-off**: Not shareable across devices or users. For a team product, I'd use a backend (Postgres + REST or GraphQL) with optimistic UI updates.

### Immutable Audit Trail

History entries are **append-only**:
```js
// ✅ Always push to a new array — never mutate existing entries
c.history = [...c.history, { action, stage, timestamp }];
```
This is enforced in code by never exposing a direct mutation API for history. Once written to localStorage, timestamps and actions are never overwritten. This satisfies the "once something is recorded, it can never be altered" requirement.

### Search Engine Design

The search system has two layers:

**1. NLP-style Intent Parser** (`parseQuery()`):
- Regex + token-matching to extract structured intents from natural English
- Handles: stage filters, stuck-for-duration, moved-since-date, offer-not-hired, exclusions
- Fallback: if no structured intent is found, the whole query is treated as a name search
- Returns structured errors with helpful messages when the query makes no sense

**2. Fuzzy Name Matching** (`fuzzyScore()` + `levenshtein()`):
- Levenshtein edit distance for typo tolerance (handles "sharam" → "Sharma")
- Substring match takes priority (score = 1.0)
- Word-level partial matching for multi-word names
- Results sorted by relevance score, poorest matches filtered out (threshold 0.25)

**Why Levenshtein over a library like Fuse.js?**  
Fuse.js would have been valid, but adding an external script felt unnecessary when Levenshtein is ~20 lines and gives full control. I also disagreed with the AI here — see below.

### Stage Advancement Rules

- Stages are an ordered array: `['Applied', 'Screening', 'Interview', 'Offer', 'Hired']`
- `nextStage()` simply looks up the index — skipping is impossible by design
- `Hired` is a terminal state; `advanceCandidate()` returns `null` if already hired
- `Rejected` is a terminal state; rejected candidates cannot be re-opened (immutable audit)
- Reversals are structurally prevented — there is no `previousStage()` function

---

## 🔍 Search Query Examples

| You type | What happens |
|---|---|
| `Priya` | Fuzzy name search, finds "Priya Sharma" even with typos |
| `sharam` | Levenshtein match finds "Sharma" |
| `in Interview` | Shows all candidates currently in Interview stage |
| `who's in Screening` | Same as above |
| `stuck in Screening for more than a week` | Candidates in Screening ≥ 7 days |
| `moved to Interview since Monday` | Candidates who entered Interview in last N days |
| `offer not hired` | Candidates who reached Offer but aren't Hired |
| `everyone except rejected` | All candidates excluding Rejected stage |
| `in Screening since 3 days` | Combined: stage + recency |
| Nonsense query | Explains what went wrong, doesn't silently return empty |

---

## 🤖 AI Disagreement

> **"Add Fuse.js for fuzzy search instead of writing Levenshtein yourself"**

The AI suggested using Fuse.js (a popular fuzzy search library) via a CDN `<script>` tag. I disagreed and wrote a custom Levenshtein implementation instead, for two reasons:

1. **External CDN dependency in a static file** creates a failure mode: if the CDN is unavailable, search breaks entirely. The app is designed to work offline.
2. **Fuse.js's scoring** is opaque — it combines multiple heuristics into one score with non-obvious weights. For this use case, I wanted explicit control: exact substring = 1.0, word-level edit-distance scaled by word length. This makes the ranking predictable and debuggable.

The cost: ~20 extra lines of code vs. the full Fuse.js API. The benefit: no external dependency, full control, offline-safe.

---

## ⏱️ What I'd Do With More Time

1. **Backend + Database**: Replace localStorage with a Postgres database. Use Supabase for a quick BaaS setup. This enables multi-user support and cross-device sync.

2. **Real-time updates**: Add WebSocket/SSE so multiple recruiters see live pipeline changes.

3. **More search intelligence**: 
   - Spell correction at the word boundary (Soundex or phonetic matching)
   - Query expansion (e.g., "dev" matches "developer", "development")
   - Date range queries: "applied in September"

4. **Email integration**: Click a candidate email to draft a stage-advancement email template.

5. **Analytics dashboard**: Time-to-hire, stage conversion rates, avg days per stage.

6. **Drag-and-drop Kanban**: Let recruiters drag cards between columns (with the same immutable audit trail recording the move).

7. **Tests**: Unit tests for `parseQuery()`, `applySearch()`, `advanceCandidate()`, and the immutability of `history`. I'd use Vitest for this.

8. **Accessibility audit**: Keyboard navigation for the entire board, ARIA live regions for search results, high-contrast mode.

---

## 📁 File Structure

```
.
├── index.html     # App shell, modals, semantic HTML
├── styles.css     # Dark theme, glassmorphism, animations
├── app.js         # All logic: state, search, rendering
├── README.md      # This file
└── instructions.md
```

---

## 🧠 AI Chat Logs

See `ai_chat_logs.md` in this repository for the full conversation transcript, including the moment I disagreed with the AI on the Fuse.js suggestion.
