var form = document.getElementById('gen-form');
var submitBtn = document.getElementById('submit');
var statusEl = document.getElementById('status');

function showStatus(kind, message) {
  statusEl.className = 'gen-status gen-status--' + kind;
  statusEl.textContent = message;
  statusEl.hidden = false;
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
    // The brief is persisted; route to its permalink rather than rendering
    // inline. replace() keeps the form out of history so Back returns to the
    // gallery, not this page.
    location.replace('brief.html?slug=' + encodeURIComponent(brief.slug));
  } catch (err) {
    showStatus('error', "Couldn't generate that brief: " + err.message + ' Please try again.');
    submitBtn.disabled = false;
  }
});
