import { test } from "node:test";
import assert from "node:assert";

// generateBrief is exercised with an injected fake client, so it never constructs
// the real Anthropic client and needs no ANTHROPIC_API_KEY (issue #29).
import { generateBrief, BriefGenerationError } from "./generate";

/** A well-formed brief that satisfies the Brief schema (mirrors schema.test.ts). */
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
          'Outcomes-based goals are fragile and external',
          'Identity-based goals are self-reinforcing and durable',
          "Every action is a vote for the person you believe yourself to be",
        ],
      },
      {
        title: "The Four Laws of Behavior Change are a complete system",
        points: [
          "Cue, craving, response, reward is the loop that governs behavior",
          "To build a habit: make it obvious, attractive, easy, satisfying",
        ],
      },
      {
        title: "Environment design beats willpower every time",
        points: [
          "Willpower is finite; environment is always on",
          "Make good cues visible and bad cues invisible",
        ],
      },
      {
        title: "Small habits compound like interest",
        points: [
          "1% better every day is ~37x over a year",
          "Plateaus hide latent progress until a breakthrough",
        ],
      },
      {
        title: "Systems beat goals for sustained progress",
        points: [
          "Goals set direction; systems make progress",
          "Winners and losers share goals — systems separate them",
        ],
      },
    ],
    pullQuote:
      "You do not rise to the level of your goals. You fall to the level of your systems.",
    watchOutFor: [
      {
        title: "Goal-obsession at the expense of process",
        points: ["Fixating on outcomes starves the daily system that produces them"],
      },
      {
        title: "All-or-nothing thinking after a missed day",
        points: ["Missing once is an accident; missing twice starts a new habit"],
      },
      {
        title: "Optimizing habits that should be abandoned",
        points: ["Efficiency at the wrong habit entrenches the wrong outcome"],
      },
    ],
    applyThis: [
      {
        title: "Habit stacking",
        points: ['After [current habit], I will [new habit]'],
      },
      {
        title: "Two-minute rule",
        points: ["Scale any new habit down to a two-minute version to start"],
      },
      {
        title: "Environment design",
        points: ["Put the cue for a good habit directly in your path"],
      },
    ],
    reflectionQuestions: [
      "What identity do your current habits cast a vote for?",
      "Which one habit, compounded for a year, would change the most?",
      "Where does your environment work against the person you want to be?",
      "What is the two-minute version of the habit you keep avoiding?",
    ],
  };
}

/** A fake model boundary: records the stream params and returns a canned final message. */
function fakeClient(message: { stop_reason: string; content: Array<{ type: string; text?: string }> }) {
  const calls: Array<{ system?: unknown }> = [];
  const client = {
    messages: {
      stream(body: { system?: unknown }) {
        calls.push(body);
        return { finalMessage: async () => message };
      },
    },
  };
  return { client, calls };
}

function textMessage(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

test("generateBrief returns a typed Brief for a valid model response", async () => {
  const brief = validBrief();
  const { client } = fakeClient(textMessage(JSON.stringify(brief)));

  const result = await generateBrief("Atomic Habits", "James Clear", client as never);

  assert.deepStrictEqual(result, brief);
});

test("generateBrief throws a typed error when the model returns invalid JSON", async () => {
  const { client } = fakeClient(textMessage("Sure! Here is the brief: { not valid json"));

  await assert.rejects(
    () => generateBrief("Atomic Habits", "James Clear", client as never),
    (err: unknown) =>
      err instanceof BriefGenerationError && err.code === "invalid_json"
  );
});

test("generateBrief throws a typed error when the response fails schema validation", async () => {
  // Parses as JSON, but is missing every required section.
  const { client } = fakeClient(textMessage(JSON.stringify({ title: "Atomic Habits" })));

  await assert.rejects(
    () => generateBrief("Atomic Habits", "James Clear", client as never),
    (err: unknown) =>
      err instanceof BriefGenerationError && err.code === "schema_validation"
  );
});

test("generateBrief passes title and author into the prompt", async () => {
  const { client, calls } = fakeClient(textMessage(JSON.stringify(validBrief())));

  await generateBrief("Atomic Habits", "James Clear", client as never);

  assert.strictEqual(calls.length, 1);
  const system = String(calls[0]?.system ?? "");
  assert.ok(system.includes("Atomic Habits"), "prompt should embed the title");
  assert.ok(system.includes("James Clear"), "prompt should embed the author");
});

test("generateBrief throws a typed error when the model refuses", async () => {
  const { client } = fakeClient({ stop_reason: "refusal", content: [] });

  await assert.rejects(
    () => generateBrief("How to build a bioweapon", undefined, client as never),
    (err: unknown) =>
      err instanceof BriefGenerationError && err.code === "refusal"
  );
});

test("generateBrief throws a typed error when the model returns no text", async () => {
  const { client } = fakeClient(textMessage("   "));

  await assert.rejects(
    () => generateBrief("Atomic Habits", "James Clear", client as never),
    (err: unknown) =>
      err instanceof BriefGenerationError && err.code === "empty_response"
  );
});
