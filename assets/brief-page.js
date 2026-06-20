var loadingEl = document.getElementById('loading');
var briefEl = document.getElementById('brief');

function showNotFound() {
  loadingEl.hidden = true;
  document.title = 'Brief not found · ReadLess';
  briefEl.innerHTML =
    '<div class="brief-missing">' +
    '<h1>Brief not found</h1>' +
    '<p>We couldn’t find a brief for that link. <a href="/">Browse all books</a> or ' +
    '<a href="/generate.html">generate a new one</a>.</p>' +
    '</div>';
}

async function load() {
  var slug = new URLSearchParams(location.search).get('slug');
  if (!slug || !slug.trim()) {
    showNotFound();
    return;
  }
  slug = slug.trim();

  // A just-generated brief may live only in sessionStorage when KV is unconfigured
  // and nothing was persisted (issue #49). Render it directly before falling back to
  // the API, which is the source of truth for seeded and persisted briefs.
  try {
    var cached = sessionStorage.getItem('brief:' + slug);
    if (cached) {
      var stashed = JSON.parse(cached);
      loadingEl.hidden = true;
      document.title = stashed.title + ' · ReadLess';
      briefEl.innerHTML = window.renderBrief(stashed);
      return;
    }
  } catch (e) {
    // Corrupt or unavailable storage — fall through to the API fetch below.
  }

  try {
    var res = await fetch('/api/briefs/' + encodeURIComponent(slug));
    if (!res.ok) {
      showNotFound();
      return;
    }
    var brief = await res.json();
    loadingEl.hidden = true;
    document.title = brief.title + ' · ReadLess';
    briefEl.innerHTML = window.renderBrief(brief);
  } catch (err) {
    showNotFound();
  }
}

load();
