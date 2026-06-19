import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse, type HTMLElement } from "node-html-parser";

import { logger } from "../lib/logger";
import { BriefSchema, type Brief, type BulletItem, type Comparison } from "../lib/schema";

/**
 * One-shot migration of the 10 curated `books/{slug}/index.html` pages into
 * schema-valid Briefs in `data/seeds.json` (spec 0004). The editorial content is
 * preserved verbatim — never regenerated — and metadata is merged from
 * `books-index.json`.
 *
 * The corpus carries two hand-written HTML structures that diverge in class
 * names but share one semantic: each section is colour-coded by a fixed accent
 * (grey thesis, green insights, red watch-outs, amber comparison, blue apply,
 * purple reflection). The parser keys off that accent rather than label text, so
 * it spans both structures and tolerates the varying comparison-label wording.
 * Any section whose accent maps to no Brief field is reported, never dropped.
 */

/** A single entry of `books-index.json` — the metadata source of truth. */
export interface BookMeta {
  slug: string;
  title: string;
  author: string;
  year: number;
  tags: string[];
  category: string;
  cover: string;
  date_added: string;
  read_time: string;
}

export interface ParseResult {
  brief: Brief;
  /** Human-readable flags for page sections the parser could not map. */
  unmapped: string[];
}

/** The semantic role a section accent denotes. */
type Accent = "grey" | "green" | "red" | "amber" | "blue" | "purple";

/** `label-*` class (spiritual pages) → accent. */
const CLASS_ACCENT: Record<string, Accent> = {
  "label-grey": "grey",
  "label-green": "green",
  "label-red": "red",
  "label-amber": "amber",
  "label-blue": "blue",
  "label-purple": "purple",
};

/** Inline `color:` hex (secular pages) → accent. */
const HEX_ACCENT: Record<string, Accent> = {
  "#888": "grey",
  "#0a8a5c": "green",
  "#c0392b": "red",
  "#b07800": "amber",
  "#1a4db0": "blue",
  "#5b3fa0": "purple",
};

/** Which Brief bullet field a bullet-list accent feeds. */
const BULLET_FIELD: Partial<Record<Accent, "keyInsights" | "watchOutFor" | "applyThis">> = {
  green: "keyInsights",
  red: "watchOutFor",
  blue: "applyThis",
};

/** Selectors that union both structures, "bs" (secular) and "label" (spiritual). */
const SEL = {
  sectionLabel: ".bs-section-label, .section-label",
  thesis: ".bs-thesis, .thesis",
  pullQuote: ".bs-quote p, .pull-quote",
  bulletList: "ul.bs-list, ul.insight-list",
  bulletTitle: ".bs-item-title, .insight-title",
  subBullet: ".bs-sub-list li, .sub-bullets li",
  table: ".bs-table, .compare-table",
  reflection: ".bs-qtext, .reflect-question",
} as const;

/** Collapse runs of whitespace and trim — the pages are pretty-printed. */
function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Read a section label's accent from its class, then its inline colour. */
function accentOf(label: HTMLElement): Accent | null {
  for (const cls of Object.keys(CLASS_ACCENT)) {
    if (label.classList.contains(cls)) return CLASS_ACCENT[cls]!;
  }
  const style = label.getAttribute("style") ?? "";
  const match = style.match(/color:\s*(#[0-9a-fA-F]+)/);
  if (match) return HEX_ACCENT[match[1]!.toLowerCase()] ?? null;
  return null;
}

/** Parse one primary bullet `<li>` into its title and sub-points. */
function parseBullet(li: HTMLElement): BulletItem {
  const title = clean(li.querySelector(SEL.bulletTitle)?.text ?? "");
  const points = li.querySelectorAll(SEL.subBullet).map((p) => clean(p.text));
  return { title, points };
}

/** Direct `<li>` children of a bullet list (excludes nested sub-bullet items). */
function directListItems(ul: HTMLElement): HTMLElement[] {
  return ul.childNodes.filter(
    (node): node is HTMLElement => (node as HTMLElement).tagName === "LI"
  );
}

/** Build the optional comparison from the page table and its amber label. */
function parseComparison(root: HTMLElement, label: string): Comparison | undefined {
  const table = root.querySelector(SEL.table);
  if (!table) return undefined;
  const columns = table.querySelectorAll("thead th").map((th) => clean(th.text));
  const rows = table
    .querySelectorAll("tbody tr")
    .map((tr) => tr.querySelectorAll("td").map((td) => clean(td.text)));
  return { label, columns, rows };
}

/**
 * Parse a single brief page into a Brief, merging in its `books-index` metadata.
 * Sections are located by accent so both HTML structures parse identically;
 * any labelled section whose accent is unknown is returned in `unmapped`.
 */
export function parseBrief(html: string, meta: BookMeta): ParseResult {
  const root = parse(html);
  const unmapped: string[] = [];

  let comparisonLabel = "Concept Comparison";
  for (const label of root.querySelectorAll(SEL.sectionLabel)) {
    const accent = accentOf(label);
    if (!accent) {
      unmapped.push(`unmapped section "${clean(label.text)}"`);
      continue;
    }
    if (accent === "amber") comparisonLabel = clean(label.text);
  }

  const insights: Record<string, BulletItem[]> = {
    keyInsights: [],
    watchOutFor: [],
    applyThis: [],
  };
  for (const ul of root.querySelectorAll(SEL.bulletList)) {
    const prev = ul.previousElementSibling;
    const accent = prev ? accentOf(prev) : null;
    const field = accent ? BULLET_FIELD[accent] : undefined;
    if (!field) continue;
    insights[field] = directListItems(ul).map(parseBullet);
  }

  const comparison = parseComparison(root, comparisonLabel);

  const brief: Brief = {
    slug: meta.slug,
    title: meta.title,
    author: meta.author,
    year: meta.year,
    category: meta.category,
    tags: meta.tags,
    cover: meta.cover,
    dateAdded: meta.date_added,
    readTime: meta.read_time,
    thesis: clean(root.querySelector(SEL.thesis)?.text ?? ""),
    keyInsights: insights.keyInsights!,
    pullQuote: clean(root.querySelector(SEL.pullQuote)?.text ?? ""),
    watchOutFor: insights.watchOutFor!,
    applyThis: insights.applyThis!,
    reflectionQuestions: root.querySelectorAll(SEL.reflection).map((q) => clean(q.text)),
    ...(comparison && { comparison }),
  };

  return { brief, unmapped };
}

/** Read, parse, validate, and write `data/seeds.json` from the curated pages. */
function main(): void {
  const indexUrl = new URL("../books-index.json", import.meta.url);
  const index = JSON.parse(readFileSync(indexUrl, "utf8")) as BookMeta[];

  const seeds: Brief[] = [];
  let problems = 0;

  for (const meta of index) {
    const pageUrl = new URL(`../books/${meta.slug}/index.html`, import.meta.url);
    const html = readFileSync(pageUrl, "utf8");
    const { brief, unmapped } = parseBrief(html, meta);

    if (unmapped.length > 0) {
      problems += unmapped.length;
      logger.warn("brief has unmapped sections", { slug: meta.slug, unmapped });
    }

    const result = BriefSchema.safeParse(brief);
    if (!result.success) {
      problems += 1;
      logger.error("brief failed schema validation", undefined, {
        slug: meta.slug,
        issues: result.error.issues,
      });
      continue;
    }
    seeds.push(result.data);
  }

  if (problems > 0) {
    logger.error("migration aborted — sections need manual fill", undefined, { problems });
    process.exitCode = 1;
    return;
  }

  const outUrl = new URL("../data/seeds.json", import.meta.url);
  writeFileSync(fileURLToPath(outUrl), `${JSON.stringify(seeds, null, 2)}\n`);
  logger.info("migration complete", { count: seeds.length });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
