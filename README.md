# ReadLess · Book Intelligence

A personal repository of AI-generated book summaries. Distilled insights, actionable takeaways, and the ideas that matter — without reading the books.

## Structure

```
readless/
├── index.html              ← Grid view (the homepage)
├── books-index.json        ← Master book list, consumed by the grid
├── books/
│   └── {slug}/
│       ├── index.html      ← AI-generated summary page
└── README.md
```

## Adding a New Book

### Step 1 — Generate the summary
Open Claude (desktop or web) and paste the contents of `book-summary-prompt.md`.
Fill in the 6 fields at the top: title, author, year, category, tags, date.
Claude will output a complete `index.html` file.

### Step 2 — Add the files
```
books/{slug}/index.html      ← paste Claude's output here
```

### Step 3 — Update the index
Add an entry to `books-index.json` with the metadata below.

**metadata.json format:**
```json
{
  "slug": "your-book-slug",
  "title": "Book Title",
  "author": "Author Name",
  "year": 2024,
  "tags": ["tag1", "tag2", "tag3"],
  "category": "Category",
  "cover": "https://covers.openlibrary.org/b/isbn/YOUR_ISBN-L.jpg",
  "date_added": "2026-03-16",
  "read_time": "10 min"
}
```

**Finding cover images:**
Use Open Library: `https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg`
Or use any direct image URL.

### Step 4 — Publish
```bash
git add .
git commit -m "Add: {Book Title}"
git push
```

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. Go to Settings → Pages
3. Set source to `main` branch, root `/`
4. Your site will be live at `https://{username}.github.io/{repo-name}/`

## Finding ISBNs
- [Open Library](https://openlibrary.org) — search the book, find ISBN-13
- [ISBN Search](https://isbnsearch.org)

## Tech Stack
- Zero dependencies — pure HTML, CSS, vanilla JS
- Google Fonts (Fraunces + Inter) — loaded via CDN
- GitHub Pages — free static hosting
- No build step, no framework, no database
