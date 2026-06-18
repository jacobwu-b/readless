import { test } from "node:test";
import assert from "node:assert";

import { BriefSchema, COUNTS } from "./schema";

// A well-formed brief modeled on the existing curated "Atomic Habits" page,
// trimmed to the smallest realistic shape the schema must accept.
function validBrief() {
  return {
    slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    year: 2018,
    category: "Self-Development",
    tags: ["habits", "productivity", "self-improvement", "behavior change"],
    cover: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    dateAdded: "2026-03-08",
    readTime: "9 min",
    thesis:
      "You do not rise to the level of your goals — you fall to the level of your systems. Lasting change is the compounding effect of tiny, consistent improvements.",
    keyInsights: [
      {
        title: "Identity change is the real mechanism — behavior follows belief",
        points: [
          'Outcomes-based: "I want to run a marathon" is fragile and external',
          'Identity-based: "I am a runner" is self-reinforcing and durable',
          "Every action is a vote for the person you believe yourself to be",
        ],
      },
      {
        title: "The Four Laws of Behavior Change are a complete system",
        points: [
          "Cue, craving, response, reward is the loop that governs behavior",
          "To build: make it obvious, attractive, easy, satisfying",
        ],
      },
      {
        title: "Environment design beats willpower every time",
        points: [
          "Willpower is finite; environment is always on",
          "The most disciplined people design environments requiring least of it",
        ],
      },
      {
        title: "The Plateau of Latent Potential explains why people quit too soon",
        points: [
          "Results are delayed, like heating ice that does nothing until 32°F",
          'Most people quit in the "valley of disappointment"',
        ],
      },
      {
        title: "Habit stacking and implementation intentions raise follow-through",
        points: [
          'Implementation intention: "I will [behavior] at [time] in [location]"',
          "Specificity of plan matters more than strength of intention",
        ],
      },
    ],
    pullQuote:
      "You do not rise to the level of your goals. You fall to the level of your systems.",
    watchOutFor: [
      {
        title: "Motion vs. action confusion",
        points: [
          "Planning and researching feel productive but produce no output",
          "Motion is preparation; action is execution",
        ],
      },
      {
        title: "Outcome-based identity",
        points: ["Goals without identity change produce temporary results"],
      },
      {
        title: 'The "never miss twice" rule misapplied',
        points: ["Missing once is an accident; missing twice starts a new habit"],
      },
    ],
    comparison: {
      label: "The Four Laws Compared",
      columns: ["Law", "To Build a Habit", "To Break a Habit"],
      rows: [
        ["1st — Cue", "Make it obvious", "Make it invisible"],
        ["2nd — Craving", "Make it attractive", "Make it unattractive"],
        ["3rd — Response", "Make it easy", "Make it difficult"],
        ["4th — Reward", "Make it satisfying", "Make it unsatisfying"],
      ],
    },
    applyThis: [
      {
        title: "Design your environment before relying on motivation",
        points: ["Phone out of bedroom, running shoes by the door"],
      },
      {
        title: "Write an implementation intention for every new habit",
        points: ['Format: "I will [behavior] at [time] in [location]"'],
      },
      {
        title: "Reframe your identity around every habit you want to build",
        points: ['Not "I\'m trying to write" but "I am a writer"'],
      },
      {
        title: "Use the two-minute rule to eliminate starting resistance",
        points: ["Scale any habit down to a version that takes two minutes or less"],
      },
    ],
    reflectionQuestions: [
      "What habits are running on autopilot, reinforcing an identity you did not choose?",
      "Where are you in the Plateau of Latent Potential, about to quit before the breakthrough?",
      "Think of a behavior you failed to sustain — which of the Four Laws was broken?",
      "What environments in your life are silently working against you?",
    ],
  };
}

test("BriefSchema accepts a well-formed brief", () => {
  const result = BriefSchema.safeParse(validBrief());
  assert.strictEqual(result.success, true, result.success ? "" : JSON.stringify(result.error.issues));
});

test("BriefSchema accepts a brief with no comparison (comparison is optional)", () => {
  const brief = validBrief();
  delete (brief as Record<string, unknown>).comparison;
  assert.strictEqual(BriefSchema.safeParse(brief).success, true);
});

test("BriefSchema rejects a brief missing a required section", () => {
  const brief = validBrief();
  delete (brief as Record<string, unknown>).keyInsights;
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("BriefSchema rejects a brief missing required metadata", () => {
  const brief = validBrief();
  delete (brief as Record<string, unknown>).slug;
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("BriefSchema rejects unknown extra top-level fields", () => {
  const brief = { ...validBrief(), summary: "an extra field that is not in the contract" };
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("BriefSchema rejects unknown extra fields inside a bullet item", () => {
  const brief = validBrief();
  (brief.keyInsights[0] as Record<string, unknown>).color = "#0a8a5c";
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("BriefSchema requires exactly five key insights", () => {
  const four = validBrief();
  four.keyInsights = four.keyInsights.slice(0, 4);
  assert.strictEqual(BriefSchema.safeParse(four).success, false, "four insights should fail");

  const six = validBrief();
  six.keyInsights = [...six.keyInsights, six.keyInsights[0]!];
  assert.strictEqual(BriefSchema.safeParse(six).success, false, "six insights should fail");
});

test("BriefSchema requires exactly four reflection questions", () => {
  const three = validBrief();
  three.reflectionQuestions = three.reflectionQuestions.slice(0, 3);
  assert.strictEqual(BriefSchema.safeParse(three).success, false);
});

test("BriefSchema accepts three or four watch-outs and rejects two or five", () => {
  const two = validBrief();
  two.watchOutFor = two.watchOutFor.slice(0, 2);
  assert.strictEqual(BriefSchema.safeParse(two).success, false, "two watch-outs should fail");

  const four = validBrief();
  four.watchOutFor = [...four.watchOutFor, four.watchOutFor[0]!];
  assert.strictEqual(BriefSchema.safeParse(four).success, true, "four watch-outs should pass");

  const five = validBrief();
  five.watchOutFor = [...four.watchOutFor, four.watchOutFor[0]!];
  assert.strictEqual(BriefSchema.safeParse(five).success, false, "five watch-outs should fail");
});

test("BriefSchema accepts three apply-this items (corpus minimum) and rejects two", () => {
  const three = validBrief();
  three.applyThis = three.applyThis.slice(0, 3);
  assert.strictEqual(BriefSchema.safeParse(three).success, true, "three apply items should pass");

  const two = validBrief();
  two.applyThis = two.applyThis.slice(0, 2);
  assert.strictEqual(BriefSchema.safeParse(two).success, false, "two apply items should fail");

  const six = validBrief();
  six.applyThis = [...three.applyThis, ...three.applyThis];
  assert.strictEqual(BriefSchema.safeParse(six).success, false, "six apply items should fail");
});

test("BriefSchema rejects a comparison row whose length does not match the columns", () => {
  const brief = validBrief();
  brief.comparison!.rows[0] = ["1st — Cue", "Make it obvious"]; // 2 cells, 3 columns
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("BriefSchema rejects a comparison with fewer than two columns", () => {
  const brief = validBrief();
  brief.comparison = {
    label: "Too narrow",
    columns: ["Only one"],
    rows: [["a"], ["b"]],
  };
  assert.strictEqual(BriefSchema.safeParse(brief).success, false);
});

test("COUNTS exposes the section bounds the schema enforces", () => {
  assert.strictEqual(COUNTS.keyInsights, 5);
  assert.strictEqual(COUNTS.reflectionQuestions, 4);
  assert.strictEqual(COUNTS.watchOutForMin, 3);
  assert.strictEqual(COUNTS.watchOutForMax, 4);
  assert.strictEqual(COUNTS.applyThisMin, 3);
  assert.strictEqual(COUNTS.applyThisMax, 5);
});
