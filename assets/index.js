let allBooks = [];
let activeFilter = 'all';

// Brief index entries come from the API (KV + seeds) and are partly
// LLM/user-sourced, so every interpolated value is escaped before it
// reaches innerHTML — matching assets/brief.js.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function init() {
  try {
    const res = await fetch('/api/briefs');
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    allBooks = await res.json();
  } catch (err) {
    document.getElementById('grid').innerHTML =
      `<div class="empty"><p>Couldn’t load the library. Please refresh.</p></div>`;
    return;
  }

  // Build category filters
  const categories = [...new Set(allBooks.map(b => b.category))].sort();
  const filterWrap = document.getElementById('filter-tags');
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => setFilter(cat, btn));
    filterWrap.appendChild(btn);
  });

  document.getElementById('search').addEventListener('input', render);
  document.querySelector('[data-filter="all"]').addEventListener('click', (e) => setFilter('all', e.target));

  document.getElementById('footer-count').textContent = `${allBooks.length} book${allBooks.length !== 1 ? 's' : ''}`;
  render();
}

function setFilter(filter, btn) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function render() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const grid = document.getElementById('grid');

  let books = allBooks;

  if (activeFilter !== 'all') {
    books = books.filter(b => b.category === activeFilter);
  }

  if (query) {
    books = books.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.tags.some(t => t.toLowerCase().includes(query)) ||
      b.category.toLowerCase().includes(query)
    );
  }

  const count = document.getElementById('result-count');
  count.textContent = query || activeFilter !== 'all'
    ? `${books.length} result${books.length !== 1 ? 's' : ''}`
    : '';

  grid.innerHTML = '';

  if (books.length === 0) {
    grid.innerHTML = `<div class="empty"><p>No books found. Try a different search.</p></div>`;
    return;
  }

  books.forEach(book => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `brief.html?slug=${encodeURIComponent(book.slug)}`;

    const initial = escapeHtml((book.title[0] || '?').toUpperCase());
    const placeholderHTML = `<div class="card-cover-placeholder"><span>${initial}</span></div>`;
    const coverHTML = book.cover
      ? `<img class="card-cover" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}" loading="lazy">`
      : placeholderHTML;

    const tagsHTML = book.tags.slice(0, 3).map(t =>
      `<span class="card-tag">${escapeHtml(t)}</span>`
    ).join('');

    card.innerHTML = `
      ${coverHTML}
      <div class="card-body">
        <div class="card-category">${escapeHtml(book.category)}</div>
        <div class="card-title">${escapeHtml(book.title)}</div>
        <div class="card-author">${escapeHtml(book.author)}, ${escapeHtml(book.year)}</div>
        <div class="card-tags">${tagsHTML}</div>
        <div class="card-meta">${escapeHtml(book.readTime)} read · Added ${formatDate(book.dateAdded)}</div>
      </div>
    `;

    // Swap a broken cover for the initial placeholder. Attached via JS rather
    // than an inline onerror handler so script-src can drop 'unsafe-inline'.
    const cover = card.querySelector('img.card-cover');
    if (cover) {
      cover.addEventListener('error', () => { cover.outerHTML = placeholderHTML; });
      if (cover.complete && cover.naturalWidth === 0) cover.outerHTML = placeholderHTML;
    }

    grid.appendChild(card);
  });
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00'); // local midnight → no UTC off-by-one
  if (isNaN(d.getTime())) return escapeHtml(str);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

init();
