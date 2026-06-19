import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BriefSchema, type Brief } from "../lib/schema";
import { parseBrief, type BookMeta } from "./migrate-briefs";

/**
 * Two real structures exist in the corpus and the parser must handle both:
 *  - "bs" — the secular pages (atomic-habits, sapiens, thinking-fast-and-slow):
 *    `.bs-section-label` carries the accent as an inline `style` color.
 *  - "label" — the spiritual pages (the other seven): `.section-label.label-*`
 *    carries the accent as a class, and sub-bullet text sits directly in the
 *    `<li>` (often wrapped in `<strong>`/`<em>`).
 * The fixtures below are minimal but exercise every selector the parser reads.
 */

const META: BookMeta = {
  slug: "atomic-habits",
  title: "Atomic Habits",
  author: "James Clear",
  year: 2018,
  tags: ["habits", "productivity", "behavior change"],
  category: "Self-Development",
  cover: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
  date_added: "2026-03-08",
  read_time: "9 min",
};

/** A bullet section in the "bs" structure: accent via inline style color. */
function bsBullets(color: string, label: string, items: [string, string[]][]): string {
  const lis = items
    .map(
      ([title, points]) => `
        <li>
          <div class="bs-dot" style="background:${color};"></div>
          <div class="bs-item">
            <div class="bs-item-title">${title}</div>
            <ul class="bs-sub-list">
              ${points
                .map((p) => `<li><div class="bs-subdot"></div><div>${p}</div></li>`)
                .join("")}
            </ul>
          </div>
        </li>`
    )
    .join("");
  return `
    <div class="bs-section">
      <div class="bs-section-label" style="color:${color};">${label}</div>
      <ul class="bs-list">${lis}</ul>
    </div>`;
}

/** A complete "bs"-structure page with every section present. */
function bsFixture(): string {
  const insights: [string, string[]][] = [
    ["Identity change is the real mechanism", ["Every action is a vote", "Become the type of person"]],
    ["The four laws are a complete system", ["Cue, craving, response, reward", "Each maps to an intervention"]],
    ["Environment beats willpower", ["Willpower is finite", "Design the space"]],
    ["The plateau of latent potential", ["Results are delayed", "Quit in the valley of disappointment"]],
    ["Habit stacking compounds follow-through", ["Anchor to an existing habit", "Specificity beats intention"]],
  ];
  const watch: [string, string[]][] = [
    ["Motion vs. action confusion", ["Planning feels productive", "Motion is preparation"]],
    ["Outcome-based identity", ["Goals end when achieved", "Identity is durable"]],
    ["Misapplying never-miss-twice", ["One miss is an accident", "Two is a new habit"]],
  ];
  const apply: [string, string[]][] = [
    ["Design your environment first", ["Phone out of the bedroom", "Audit each space"]],
    ["Write an implementation intention", ["I will X at time in place", "Specific plans execute"]],
    ["Reframe identity around the habit", ["Not trying to write, but a writer", "Ask what they would do"]],
    ["Use the two-minute rule", ["Scale to two minutes", "Master showing up"]],
  ];
  return `<!DOCTYPE html><html><body>
    <div class="bs-thesis-block">
      <div class="bs-section-label" style="color:#888;">Core Thesis</div>
      <p class="bs-thesis">You do not rise to your goals; you fall to your systems.</p>
    </div>
    ${bsBullets("#0a8a5c", "Key Insights", insights)}
    <div class="bs-quote"><p>"You do not rise to the level of your goals."</p></div>
    ${bsBullets("#c0392b", "Watch Out For", watch)}
    <div class="bs-section">
      <div class="bs-section-label" style="color:#b07800;">The Four Laws Compared</div>
      <div class="bs-table-wrap">
        <table class="bs-table">
          <thead><tr><th>Law</th><th>Build</th><th>Break</th></tr></thead>
          <tbody>
            <tr><td>Cue</td><td>Make it obvious</td><td>Make it invisible</td></tr>
            <tr><td>Craving</td><td>Make it attractive</td><td>Make it unattractive</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    ${bsBullets("#1a4db0", "Apply This", apply)}
    <div class="bs-section">
      <div class="bs-section-label" style="color:#5b3fa0;">Reflection Questions</div>
      <div class="bs-qs">
        <div class="bs-q"><div class="bs-qnum">1</div><div class="bs-qtext">What habits run on autopilot?</div></div>
        <div class="bs-q"><div class="bs-qnum">2</div><div class="bs-qtext">Where are you in the plateau?</div></div>
        <div class="bs-q"><div class="bs-qnum">3</div><div class="bs-qtext">Which of the four laws broke?</div></div>
        <div class="bs-q"><div class="bs-qnum">4</div><div class="bs-qtext">Which environments work against you?</div></div>
      </div>
    </div>
  </body></html>`;
}

/** A bullet section in the "label" structure: accent via a `label-*` class. */
function labelBullets(
  cls: string,
  dot: string,
  label: string,
  items: [string, string[]][]
): string {
  const lis = items
    .map(
      ([title, points]) => `
        <li class="insight-item">
          <div class="insight-title"><span class="dot ${dot}"></span><strong>${title}</strong></div>
          <ul class="sub-bullets">
            ${points
              .map((p) => `<li class="sub-bullet"><span class="sub-dot"></span>${p}</li>`)
              .join("")}
          </ul>
        </li>`
    )
    .join("");
  return `
    <div class="section-label ${cls}">${label}</div>
    <ul class="insight-list">${lis}</ul>`;
}

/** A complete "label"-structure page with every section present. */
function labelFixture(): string {
  const insights: [string, string[]][] = [
    ["Two ways to be lost", ["The younger son is visibly lost", "The elder son is lost without knowing"]],
    ["Both want the father's goods", ["Not the father himself", "Religion can be idolatry"]],
    ["Grace is scandalously costly", ["The father runs", "Restoration without conditions"]],
    ["A third way beyond religion", ["Not moralism, not licence", "Come to the feast on love"]],
    ["The true elder brother", ["Jesus left the feast", "Paid the cost we owed"]],
  ];
  const watch: [string, string[]][] = [
    ["Labelling others, not yourself", ["The trap is self-invisible", "Hold the mirror to yourself"]],
    ["Collapsing grace into licence", ["Repentance still matters", "Reception produces change"]],
    ["Reading it as the younger son's book", ["It targets the respectable", "Sit with the discomfort"]],
  ];
  const apply: [string, string[]][] = [
    ["Run the elder-brother diagnostic", ["Answer three honest questions", "Diagnosis, not condemnation"]],
    ["Name what you slave for", ["Complete the sentence honestly", "Reorient, do not abandon"]],
    ["Meditate on the christological claim", ["Fifteen minutes on one idea", "Receive with surprise"]],
    ["Test your community against the feast", ["Welcome or wariness?", "Initiate one concrete change"]],
  ];
  return `<!DOCTYPE html><html><body>
    <div class="section-label label-grey">Core Thesis</div>
    <p class="thesis">The parable is about two lost sons and a father's reckless love.</p>
    ${labelBullets("label-green", "dot-green", "Key Insights", insights)}
    <div class="pull-quote-wrap"><div class="pull-quote">"Jesus attracted the irreligious while offending the religious."</div></div>
    ${labelBullets("label-red", "dot-red", "Watch Out For", watch)}
    <div class="section-label label-amber">Concept Comparison</div>
    <table class="compare-table">
      <thead><tr><th>Dimension</th><th>Elder Brother</th><th>Gospel Grace</th></tr></thead>
      <tbody>
        <tr><td>Relationship</td><td>Transactional</td><td>Filial</td></tr>
        <tr><td>Motivation</td><td>Fear and reward</td><td>Gratitude and love</td></tr>
      </tbody>
    </table>
    ${labelBullets("label-blue", "dot-blue", "Apply This", apply)}
    <div class="section-label label-purple">Reflection Questions</div>
    <div class="reflection-list">
      <div class="reflection-item"><div class="reflect-numeral">1</div><div class="reflect-question">Where is your obedience driven by what you are owed?</div></div>
      <div class="reflection-item"><div class="reflect-numeral">2</div><div class="reflect-question">Would God himself be enough?</div></div>
      <div class="reflection-item"><div class="reflect-numeral">3</div><div class="reflect-question">Which feast are you refusing to enter?</div></div>
      <div class="reflection-item"><div class="reflect-numeral">4</div><div class="reflect-question">If the true elder brother is real, what changes?</div></div>
    </div>
  </body></html>`;
}

test("parseBrief extracts every editorial section from the bs structure", () => {
  const { brief, unmapped } = parseBrief(bsFixture(), META);

  assert.deepStrictEqual(unmapped, [], "no sections should be left unmapped");
  assert.strictEqual(brief.thesis, "You do not rise to your goals; you fall to your systems.");
  assert.strictEqual(brief.pullQuote, '"You do not rise to the level of your goals."');

  assert.strictEqual(brief.keyInsights.length, 5);
  assert.strictEqual(brief.keyInsights[0]!.title, "Identity change is the real mechanism");
  assert.deepStrictEqual(brief.keyInsights[0]!.points, [
    "Every action is a vote",
    "Become the type of person",
  ]);

  assert.strictEqual(brief.watchOutFor.length, 3);
  assert.strictEqual(brief.watchOutFor[0]!.title, "Motion vs. action confusion");

  assert.strictEqual(brief.applyThis.length, 4);
  assert.strictEqual(brief.applyThis[3]!.title, "Use the two-minute rule");

  assert.deepStrictEqual(brief.reflectionQuestions, [
    "What habits run on autopilot?",
    "Where are you in the plateau?",
    "Which of the four laws broke?",
    "Which environments work against you?",
  ]);

  assert.ok(brief.comparison, "comparison should be present");
  assert.strictEqual(brief.comparison!.label, "The Four Laws Compared");
  assert.deepStrictEqual(brief.comparison!.columns, ["Law", "Build", "Break"]);
  assert.deepStrictEqual(brief.comparison!.rows[0], ["Cue", "Make it obvious", "Make it invisible"]);
});

test("parseBrief extracts every editorial section from the label structure", () => {
  const meta: BookMeta = { ...META, slug: "the-prodigal-god" };
  const { brief, unmapped } = parseBrief(labelFixture(), meta);

  assert.deepStrictEqual(unmapped, []);
  assert.strictEqual(brief.thesis, "The parable is about two lost sons and a father's reckless love.");
  assert.strictEqual(brief.pullQuote, '"Jesus attracted the irreligious while offending the religious."');

  assert.strictEqual(brief.keyInsights.length, 5);
  assert.strictEqual(brief.keyInsights[4]!.title, "The true elder brother");
  assert.deepStrictEqual(brief.keyInsights[4]!.points, [
    "Jesus left the feast",
    "Paid the cost we owed",
  ]);

  assert.strictEqual(brief.watchOutFor.length, 3);
  assert.strictEqual(brief.applyThis.length, 4);

  assert.deepStrictEqual(brief.reflectionQuestions, [
    "Where is your obedience driven by what you are owed?",
    "Would God himself be enough?",
    "Which feast are you refusing to enter?",
    "If the true elder brother is real, what changes?",
  ]);

  assert.ok(brief.comparison);
  assert.strictEqual(brief.comparison!.label, "Concept Comparison");
  assert.deepStrictEqual(brief.comparison!.columns, ["Dimension", "Elder Brother", "Gospel Grace"]);
});

test("parseBrief flattens inline emphasis in label-structure sub-bullets to plain text", () => {
  const html = labelFixture().replace(
    "The younger son is visibly lost",
    "The <em>younger</em> son is <strong>visibly</strong> lost"
  );
  const { brief } = parseBrief(html, { ...META, slug: "the-prodigal-god" });
  assert.strictEqual(brief.keyInsights[0]!.points[0], "The younger son is visibly lost");
});

test("parseBrief carries metadata from the books-index entry, not the page", () => {
  const { brief } = parseBrief(bsFixture(), META);
  assert.strictEqual(brief.slug, "atomic-habits");
  assert.strictEqual(brief.title, "Atomic Habits");
  assert.strictEqual(brief.author, "James Clear");
  assert.strictEqual(brief.year, 2018);
  assert.strictEqual(brief.category, "Self-Development");
  assert.deepStrictEqual(brief.tags, ["habits", "productivity", "behavior change"]);
  assert.strictEqual(brief.cover, "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg");
  assert.strictEqual(brief.dateAdded, "2026-03-08");
  assert.strictEqual(brief.readTime, "9 min");
});

test("parseBrief produces a schema-valid brief", () => {
  const { brief } = parseBrief(bsFixture(), META);
  assert.doesNotThrow(() => BriefSchema.parse(brief));
});

test("parseBrief flags a section it cannot map instead of dropping it silently", () => {
  // Inject a section whose accent maps to no known Brief field.
  const html = labelFixture().replace(
    '<div class="section-label label-purple">Reflection Questions</div>',
    '<div class="section-label" style="color:#123456;">Author Background</div>' +
      "<p>An unmapped editorial section.</p>" +
      '<div class="section-label label-purple">Reflection Questions</div>'
  );
  const { unmapped } = parseBrief(html, { ...META, slug: "the-prodigal-god" });
  assert.strictEqual(unmapped.length, 1);
  assert.match(unmapped[0]!, /Author Background/);
});

test("the committed seeds.json holds 10 schema-valid briefs with unique slugs", () => {
  const path = fileURLToPath(new URL("../data/seeds.json", import.meta.url));
  const seeds = JSON.parse(readFileSync(path, "utf8")) as unknown[];

  assert.strictEqual(seeds.length, 10, "seeds.json must contain all 10 migrated briefs");

  const slugs = new Set<string>();
  for (const seed of seeds) {
    const brief: Brief = BriefSchema.parse(seed);
    slugs.add(brief.slug);
  }
  assert.strictEqual(slugs.size, 10, "every seed slug must be unique");
});
