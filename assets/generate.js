var form = document.getElementById('gen-form');
var submitBtn = document.getElementById('submit');
var statusEl = document.getElementById('status');

// localStorage keys shared with assets/index.js (gallery) and assets/brief-page.js
// (permalink). These are plain browser scripts with no module system, so the key
// strings and the IndexEntry shape are mirrored across files by convention.
var LOCAL_INDEX_KEY = 'briefs:local';
var LOCAL_BRIEF_PREFIX = 'brief:';

function showStatus(kind, message) {
  statusEl.className = 'gen-status gen-status--' + kind;
  statusEl.textContent = message;
  statusEl.hidden = false;
}

// The gallery's lightweight projection of a Brief — the same fields lib/store.ts
// toIndexEntry() exposes, so a locally-stored entry renders identically to an API one.
function toIndexEntry(brief) {
  return {
    slug: brief.slug,
    title: brief.title,
    author: brief.author,
    year: brief.year,
    category: brief.category,
    tags: brief.tags,
    cover: brief.cover,
    dateAdded: brief.dateAdded,
    readTime: brief.readTime,
  };
}

// Persist a generated brief to localStorage so it survives without a server store: when
// KV is unconfigured (ADR-0007) nothing is written server-side, so localStorage is the
// fallback store (ADR-0009). Two records — the full brief under brief:{slug} for its
// permalink, and its gallery projection upserted (dedup by slug) into the shared
// briefs:local list the gallery merges on top of /api/briefs. Harmless when KV is on:
// the API copy wins on slug, so the gallery never double-renders it. Wrapped so an
// unavailable (private mode) or full (quota) store is non-fatal — the worst case is that
// the brief is absent after navigation, never a broken generation flow.
function saveLocalBrief(brief) {
  try {
    localStorage.setItem(LOCAL_BRIEF_PREFIX + brief.slug, JSON.stringify(brief));
    var raw = localStorage.getItem(LOCAL_INDEX_KEY);
    var list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (entry) { return entry && entry.slug !== brief.slug; });
    list.push(toIndexEntry(brief));
    localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    // localStorage unavailable or full; the API stays the source of truth.
  }
}

form.addEventListener('submit', async function (event) {
  event.preventDefault();

  var title = document.getElementById('title').value.trim();
  var author = document.getElementById('author').value.trim();
  if (!title) return;

  submitBtn.disabled = true;
  showStatus('loading', 'Generating brief for "' + title + '"… this can take a minute.');

  var payload = { title: title };
  if (author) payload.author = author;

  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      var detail = await res.json().catch(function () { return {}; });
      throw new Error(detail.error || ('Request failed (' + res.status + ')'));
    }

    var brief = await res.json();
    // Persist to localStorage so the permalink renders and the gallery shows the brief
    // even when KV is unconfigured and nothing was persisted server-side (ADR-0007/0009):
    // without a store, GET /api/briefs/:slug would 404 and the gallery would omit it.
    saveLocalBrief(brief);
    // Route to its permalink rather than rendering inline. replace() keeps the form
    // out of history so Back returns to the gallery, not this page.
    location.replace('brief.html?slug=' + encodeURIComponent(brief.slug));
  } catch (err) {
    showStatus('error', "Couldn't generate that brief: " + err.message + ' Please try again.');
    submitBtn.disabled = false;
  }
});
