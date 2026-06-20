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

  try {
    var res = await fetch('/api/briefs/' + encodeURIComponent(slug.trim()));
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
