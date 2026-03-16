Generate two files for a new book entry in my ReadLess repository. Output them in clearly labelled blocks in this exact order:

1. `index.html` — the summary page
2. `books-index.json entry` — a single JSON object to append to my books-index.json file

The summary page is a complete, self-contained HTML file using the design system and section structure defined below. Do not use any external CSS frameworks.

## Book Details

- **Title:** [BOOK TITLE]
- **Author:** [AUTHOR NAME]
- **Year:** [YEAR]
- **Category / Eyebrow:** [e.g. Psychology · Behavioral Economics]
- **Tags:** [tag1, tag2, tag3, tag4] — short, lowercase, title-case rendered
- **Read time:** [e.g. X min read - estimate accurately based on length of the book]
- **Date added:** [e.g. March 2026]

---

## Design System

### Fonts
Import from Google Fonts:
- `Fraunces` (ital, opsz, wght: 300 and 700) — used for title, subtitle, thesis, pull quote, reflection numerals
- `Inter` (wght: 400, 500) — used for all body text, labels, tags

### Color philosophy
White background throughout. No colored background blocks. Accent colors appear **only** on section labels and their matching bullet dots — sparingly. All other elements are black, near-black, or grey.

### Section accent colors (labels + dots only)
| Section | Accent color |
|---|---|
| Key Insights | `#0a8a5c` (green) |
| Watch Out For | `#c0392b` (red) |
| Concept comparison label | `#b07800` (amber) |
| Apply This | `#1a4db0` (blue) |
| Reflection Questions | `#5b3fa0` (purple) |
| Core Thesis label | `#888` (grey) |

### Typography scale
- Site label / section labels / tags: 10px, weight 500, `letter-spacing: 0.18em`, uppercase
- Body / bullets: 13px, weight 400, `line-height: 1.6`
- Sub-bullets: 12.5px, color `#444`, `line-height: 1.55`
- Pull quote: Fraunces italic 300, 17px, `line-height: 1.6`
- Book title: Fraunces 700, 34px, `letter-spacing: -0.02em`
- Book subtitle (author + year): Fraunces italic 300, 17px, color `#555`
- Thesis: Fraunces italic 300, 16px, `line-height: 1.75`, `border-left: 2px solid #111`, `padding-left: 16px`

### Structural elements
- **Top bar:** site name left ("ReadLess · Book Intelligence") + category + read time right, separated by `1.5px solid #111` border-bottom
- **Tags:** `background: #f0f0f0`, `color: #444`, `border-radius: 4px`, `padding: 4px 11px`
- **Section dividers:** `0.5px solid #e5e5e5` between sections
- **Pull quote:** `border-top: 1.5px solid #0a0a0a` and `border-bottom: 1.5px solid #0a0a0a`, full width
- **Comparison table:** black header row (`#0a0a0a`), white text, alternating `#fafafa` rows, `border: 0.5px solid #e0e0e0`, `border-radius: 8px`
- **Reflection numerals:** Fraunces 700, 22px, color `#e0e0e0` (faded)
- **Footer:** `font-size: 10px`, uppercase, color `#aaa`, flex space-between, `border-top: 0.5px solid #e5e5e5`

### Bullet structure
Every bullet in Key Insights and Apply This uses a **two-level structure**:
- **Primary bullet:** colored dot (6px circle) + bold 13px title on one line
- **Sub-bullets:** 3px grey dot + 12.5px grey text, 2–4 lines, tightly written like lecture slide notes

Watch Out For uses the same two-level structure but with red dots.

Sub-bullet text must always be wrapped in a <span> sibling to the dot span, like this:
html<li class="sub-bullet">
  <span class="sub-dot"></span>
  <span>Text content including any <em>italic titles</em> or <strong>bold phrases</strong> here.</span>
</li>
Never place inline text or formatting tags as direct children of the flex <li> alongside the dot — always wrap all text content in a single <span>. This prevents flex from fragmenting inline elements like <em> and <strong> across columns when text wraps.

---

## Section Structure (produce all sections, in this order)

### 1. Core Thesis
One italic Fraunces serif paragraph, 2–3 sentences. States the book's central argument with precision and intellectual confidence. No bullet points.

### 2. Key Insights (green)
5 insights. Each has:
- **Bold title line** — the insight in one sharp sentence
- **2–4 sub-bullets** — explaining *why* it matters, what it implies, real-world consequences. Substantive but scannable. NOT prose paragraphs — each sub-bullet is one tight clause or sentence.

### 3. Pull Quote
One single sentence from the book — the most memorable, quotable line. Full-width between double rules.

### 4. Watch Out For (red)
3–4 cognitive traps, failure modes, or common misapplications. Same two-level bullet structure.

### 5. Concept Comparison (amber label, black-header table)
A comparison table of 2 competing or contrasting concepts central to the book. 5–6 rows. Use only when the book has a clear binary or spectrum worth comparing (which most books do). Label is amber, table header is black.

### 6. Apply This (blue)
4–5 actionable takeaways. Same two-level structure. Must be concrete and specific — not "think more carefully" but "here is the exact technique."

### 7. Reflection Questions (purple)
4 questions. Numbered with large faded Fraunces numerals. Should provoke genuine self-examination — not comprehension checks, but questions that connect the book's ideas to the reader's actual life.

---

## Dark Mode
Include a `@media (prefers-color-scheme: dark)` block. In dark mode:
- Background: `#0a0a0a`
- Body text: `#f0f0f0`
- Subtext / sub-bullets: `#888`
- Tags: `background: #1a1a1a`, `color: #888`
- Section dividers: `#1a1a1a`
- Thesis border: `#555`
- Thesis text: `#ccc`
- Pull quote borders: `#444`, text `#ccc`
- Table: header `#1a1a1a`, alternating rows `#111`, borders `#1a1a1a`, body text `#888`
- Reflection numerals: `#222`
- Reflection question text: `#888`
- Footer border: `#1a1a1a`, text `#444`
- Top bar border: `#333`
- Title: `#f0f0f0`, subtitle: `#888`

---

## Quality Bar
Write this as if it's a commercial product people pay a premium subscription to access. The Key Insights should reflect genuine depth — a reader should walk away with a real understanding of the book's intellectual contribution, not just a surface summary. The Apply This section should be specific enough to act on today. The Reflection Questions should be the kind someone might journal about for 20 minutes.

---

## Output Format

Produce two files.

**File 1 — `index.html`**
A complete `<!DOCTYPE html>` file. No external dependencies except the two Google Fonts imports. Header includes a back link: `<a href="../../">← All books</a>`.

**File 2 — Append to `books-index.json`**
A single JSON object ready to paste as a new entry into the `books-index.json` array:
```json
{
  "slug": "{slug}",
  "title": "{title}",
  "author": "{author}",
  "year": {year},
  "tags": ["{tag1}", "{tag2}", "{tag3}", "{tag4}"],
  "category": "{category}",
  "cover": "https://covers.openlibrary.org/b/isbn/{ISBN13}-L.jpg",
  "date_added": "{YYYY-MM-DD}",
  "read_time": "{N} min"
}
```
Look up the ISBN-13 for the book and substitute it into the cover URL. If you cannot confirm the ISBN, use an empty string for cover and note it. Label this block clearly so I know to append it, not replace the file.
