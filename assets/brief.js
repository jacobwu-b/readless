/*
 * ReadLess brief renderer.
 *
 * Turns a Brief object (the shape validated by lib/schema.ts) into the markup the
 * hand-built per-book pages use, so any brief renders with the curated design system.
 * Plain browser script — no modules, no framework. Exposes `window.renderBrief`.
 *
 * All model-sourced text is escaped before interpolation: briefs come from an LLM,
 * so they are treated as untrusted input.
 */
(function () {
  "use strict";

  /** Section accent colors, matching the curated per-book pages. */
  var ACCENT = {
    insights: "#0a8a5c",
    watchOut: "#c0392b",
    comparison: "#b07800",
    apply: "#1a4db0",
    reflection: "#5b3fa0",
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** "2018-03-01" → "March 2026"; falls back to the raw string if unparseable. */
  function formatAdded(dateAdded) {
    var d = new Date(dateAdded + "T00:00:00");
    if (isNaN(d.getTime())) return escapeHtml(dateAdded);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  /** Renders an array of {title, points[]} as the two-level bullet list. */
  function renderBulletList(items, accent) {
    var lis = items
      .map(function (item) {
        var subs = item.points
          .map(function (point) {
            return (
              '<li><div class="bs-subdot"></div><div>' +
              escapeHtml(point) +
              "</div></li>"
            );
          })
          .join("");
        return (
          '<li><div class="bs-dot" style="background:' +
          accent +
          ';"></div><div class="bs-item">' +
          '<div class="bs-item-title">' +
          escapeHtml(item.title) +
          "</div>" +
          '<ul class="bs-sub-list">' +
          subs +
          "</ul></div></li>"
        );
      })
      .join("");
    return '<ul class="bs-list">' + lis + "</ul>";
  }

  function renderComparison(comparison) {
    if (!comparison) return "";
    var head = comparison.columns
      .map(function (col) {
        return "<th>" + escapeHtml(col) + "</th>";
      })
      .join("");
    var body = comparison.rows
      .map(function (row) {
        var cells = row
          .map(function (cell) {
            return "<td>" + escapeHtml(cell) + "</td>";
          })
          .join("");
        return "<tr>" + cells + "</tr>";
      })
      .join("");
    return (
      '<div class="bs-section">' +
      '<div class="bs-section-label" style="color:' +
      ACCENT.comparison +
      ';">' +
      escapeHtml(comparison.label) +
      "</div>" +
      '<div class="bs-table-wrap"><table class="bs-table">' +
      "<thead><tr>" +
      head +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table></div></div>"
    );
  }

  function renderReflection(questions) {
    var qs = questions
      .map(function (q, i) {
        return (
          '<div class="bs-q"><div class="bs-qnum">' +
          (i + 1) +
          '</div><div class="bs-qtext">' +
          escapeHtml(q) +
          "</div></div>"
        );
      })
      .join("");
    return (
      '<div class="bs-section" style="border-bottom:none;padding-bottom:0;">' +
      '<div class="bs-section-label" style="color:' +
      ACCENT.reflection +
      ';">Reflection Questions</div>' +
      '<div class="bs-qs">' +
      qs +
      "</div></div>"
    );
  }

  /** Renders a Brief object to an HTML string for insertion inside <main>. */
  function renderBrief(brief) {
    var tags = brief.tags
      .map(function (tag) {
        return '<span class="bs-tag">' + escapeHtml(tag) + "</span>";
      })
      .join("");

    return (
      '<div class="bs-bar">' +
      '<div class="bs-site">ReadLess · Book Intelligence</div>' +
      '<div class="bs-meta">' +
      escapeHtml(brief.category) +
      " · " +
      escapeHtml(brief.readTime) +
      " read</div>" +
      "</div>" +
      '<h1 class="bs-title">' +
      escapeHtml(brief.title) +
      "</h1>" +
      '<div class="bs-sub">' +
      escapeHtml(brief.author) +
      ", " +
      escapeHtml(brief.year) +
      "</div>" +
      '<div class="bs-tags">' +
      tags +
      "</div>" +
      '<div class="bs-thesis-block">' +
      '<div class="bs-section-label" style="color:#888;">Core Thesis</div>' +
      '<p class="bs-thesis">' +
      escapeHtml(brief.thesis) +
      "</p></div>" +
      '<div class="bs-section">' +
      '<div class="bs-section-label" style="color:' +
      ACCENT.insights +
      ';">Key Insights</div>' +
      renderBulletList(brief.keyInsights, ACCENT.insights) +
      "</div>" +
      '<div class="bs-quote"><p>' +
      escapeHtml(brief.pullQuote) +
      "</p></div>" +
      '<div class="bs-section">' +
      '<div class="bs-section-label" style="color:' +
      ACCENT.watchOut +
      ';">Watch Out For</div>' +
      renderBulletList(brief.watchOutFor, ACCENT.watchOut) +
      "</div>" +
      renderComparison(brief.comparison) +
      '<div class="bs-section">' +
      '<div class="bs-section-label" style="color:' +
      ACCENT.apply +
      ';">Apply This</div>' +
      renderBulletList(brief.applyThis, ACCENT.apply) +
      "</div>" +
      renderReflection(brief.reflectionQuestions) +
      '<div class="bs-footer"><span>Book Intelligence</span><span>Added ' +
      formatAdded(brief.dateAdded) +
      "</span></div>"
    );
  }

  window.renderBrief = renderBrief;
})();
