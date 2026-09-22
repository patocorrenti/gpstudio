/**
 * One-shot: extract FX descriptions from the GP-5 manual PDF (+ HTML fallbacks)
 * and patch src/device/catalog/*.ts with description / basedOn fields.
 *
 * Usage: node scripts/import-catalog-descriptions.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const refDir = path.join(root, "_reference");
const catalogDir = path.join(root, "src/device/catalog");

const pdf = fs.readdirSync(refDir).find((f) => f.endsWith(".pdf"));
const htmlFile = fs.readdirSync(refDir).find((f) => f.endsWith(".html"));
if (!pdf) throw new Error("No PDF in _reference");

function pdfText(from, to) {
  const out = path.join("/tmp", `gp5-${from}-${to}.txt`);
  execFileSync("pdftotext", ["-raw", "-f", String(from), "-l", String(to), path.join(refDir, pdf), out]);
  return fs.readFileSync(out, "utf8");
}

function key(s) {
  return s.toLowerCase().replaceAll("_", "").replace(/[^a-z0-9]+/g, "");
}

function cleanSpaces(s) {
  return s
    .replace(/\u00ad/g, "")
    .replace(/(\w)-\s+(\w)/g, "$1-$2")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .split(/\s+VOL:\s*/)[0]
    .trim();
}

function stripMarks(s) {
  let t = s.replace(/(?<=\w)[®™](?=\w)/g, " ");
  t = t.replace(/[®™©*]/g, "");
  t = t.replace(/(?<=[A-Za-z])TM\b/g, "");
  return t.replace(/\s+/g, " ").replace(/\s+([,.)])/g, "$1").trim();
}

const TYPE_WORDS = new Set([
  "Gate",
  "Comp",
  "Boost",
  "Filter",
  "Pitch",
  "OD",
  "Distortion",
  "Fuzz",
  "Bass Drive",
  "SnapTone",
  "Clean",
  "Drive",
  "Hi-Gain",
  "Hi Gain",
  "High Gain",
  "Bass",
  "Acoustic",
  "Small Cab",
  "Large Cab",
  "Bass Cab",
  "User IR",
  "EQ",
  "Chorus",
  "Flanger",
  "Phaser",
  "Vibrato",
  "Tremolo",
  "Delay",
  "Reverb",
  "Lead",
]);

const SECTIONS = new Set(["NR", "PRE", "DST", "N→S", "N->S", "AMP", "CAB", "EQ", "MOD", "DLY", "RVB"]);

const PARAM_START =
  /^(THRE|Sustain|VOL|Volume|Attack|Clipping|Gain|Tone|\+3dB|\+3DB|Bright|Bass(?:\/Middle\/Treble|\/Treble)?|Treble|Sense|Range|Q|Mix|Mode|Depth|Rate|Low|High|Dry|Detune|Dry\/Wet|H\/L-VOL|Blend|Filter|Fuzz|PRES|Tone cut|Tone Cut|Gain 1\/2|Band \d|Use the five|P\.Delay|F\.Back|Decay|Damp|Trail|Time|R-Mix|Freq|S-Depth|S-Rate|Mod|Position|Body|Top|Bias|Clip|Wet|H-Vol|L-VOL|Middle|Presence):\s*/i;

function normalizeLines(text) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/\f/g, "").trim();
    if (!line) continue;
    if (/^\d+$/.test(line)) continue;
    if (line === "Effect List" || line === "FX Title Type Description Parameter Description") continue;
    if (line.startsWith("*The mentioned") || line.startsWith("The trademarks were")) continue;
    if (line.startsWith("The mentioned manufacturers")) continue;
    out.push(line);
  }
  return out;
}

function restStartsWithType(rest) {
  for (const tw of [...TYPE_WORDS].sort((a, b) => b.length - a.length)) {
    if (rest === tw || rest.startsWith(tw + " ")) return true;
  }
  return false;
}

/** @returns {{ consumed: number, sameLineRest: string | null } | null} */
function matchLabel(lines, i, label) {
  const variants = label.toUpperCase() === "GATE" ? [label, "Gate"] : [label];
  for (const lab of variants) {
    const acc = [];
    for (let j = i; j < Math.min(i + 6, lines.length); j++) {
      acc.push(lines[j]);
      const joined = acc.join(" ");
      if (joined.toLowerCase() === lab.toLowerCase()) {
        return { consumed: j - i + 1, sameLineRest: null };
      }
      const low = lines[j].toLowerCase();
      const prefix = lab.toLowerCase() + " ";
      // Same-line "Title Type …" only — avoid matching prose like "vibrato sound."
      if (acc.length === 1 && low.startsWith(prefix)) {
        const rest = lines[j].slice(lab.length).trim();
        if (restStartsWithType(rest)) {
          return { consumed: 1, sameLineRest: rest };
        }
      }
      if (joined.length > lab.length + 8) break;
    }
  }
  return null;
}

function parseDesc(lines, start, stopLabs) {
  let i = start;
  if (i < lines.length && TYPE_WORDS.has(lines[i])) i += 1;
  const parts = [];
  while (i < lines.length) {
    let s = lines[i];
    if (s.includes(" VOL:") || s.startsWith("VOL:")) {
      const before = s.split(/\s*VOL:/)[0].trim();
      if (before && !TYPE_WORDS.has(before)) parts.push(before);
      break;
    }
    if (PARAM_START.test(s)) break;
    if (SECTIONS.has(s)) break;
    let stopped = false;
    for (const lab of stopLabs) {
      if (matchLabel(lines, i, lab)) {
        stopped = true;
        break;
      }
    }
    if (stopped) break;
    parts.push(s);
    i += 1;
  }
  return { desc: cleanSpaces(parts.join(" ")), next: i };
}

function extractBasedOn(desc) {
  const d = cleanSpaces(desc);

  if (/5-band EQ module on Mesa\/Boogie/i.test(d)) return "Mesa/Boogie 5-band EQ";

  let m = d.match(/modeled after (?:the |a )?(.*)$/i);
  if (m) {
    let raw = m[1];
    raw = raw.split(/(?:'s tone|['\u2019]s tone|['\u2019]s\b|\s+with\s+)/i)[0];
    raw = stripMarks(raw).replace(/^the the /i, "the ").replace(/\s+pedal$/i, "").trim();
    return raw || undefined;
  }

  m = d.match(/^Based on (?:the )?(?:famous |legendary |legenary )?(.+)$/i);
  if (m) {
    let raw = m[1];
    const withChannel = raw.match(/^(.+?\([^)]+\))/);
    if (withChannel && /\(.*channel/i.test(withChannel[1])) {
      raw = withChannel[1];
    } else if (/\*\s*\./.test(raw)) {
      raw = raw.split(/\*\s*\./)[0];
    } else {
      raw = raw.split(/\.\s+(?=This |The |It |A |An |Have |Providing |Since |With |When |In |Born |Eric |Voodoo |Jimi |MATCHLESS)/)[0];
    }
    // Drop trailing prose after the device name
    raw = raw.split(/,\s+(?:producing|offering|featuring|providing)\b/i)[0];
    raw = stripMarks(raw).trim();
    raw = raw
      .replace(
        /\s+(noise gate pedal|overdrive pedal|distortion pedal|fuzz pedal|wah pedal|stereo chorus pedal)$/i,
        "",
      )
      .trim();
    // Keep bare "pedal" only when it's the whole product identity (strip leading "a "/"an ")
    raw = raw.replace(/^(?:a|an)\s+/i, "");
    // Unwrap quoted nicknames: "Brown Eye" UK-style… → Brown Eye UK-style…
    raw = raw.replace(/^"([^"]+)"\s*/g, "$1 ").trim();
    if (raw && raw.length < 120) return raw;
  }

  m = d.match(/it is based on (.+?)(?:\.|,| which)/i);
  if (m) {
    return stripMarks(m[1]).replace(/^(?:a|an)\s+/i, "").trim() || undefined;
  }

  m = d.match(/benefit from the ([^.]+?)(?:\*|\.|$)/i);
  if (m) {
    return (
      stripMarks(m[1])
        .replace(/\s+overdrive pedal$/i, "")
        .trim() || undefined
    );
  }

  m = d.match(/talking the legendary ([^,.*]+)/i);
  if (m) return stripMarks(m[1]).trim() || undefined;

  if (/cabinet\.?$/i.test(d) && d.length < 140) {
    let raw = stripMarks(d);
    raw = raw.replace(/^(Vintage |Custom modified |Legendary |Vintgae )/i, "");
    raw = raw.replace(/\s*cabinet\.?$/i, "").trim();
    return raw || undefined;
  }

  return undefined;
}

// --- load catalog models from TS ---
const KIND_FILES = ["nr", "pre", "dst", "ns", "amp", "cab", "eq", "mod", "dly", "rvb"];
/** @type {{kind:string,id:string,label:string}[]} */
const catalog = [];
for (const kind of KIND_FILES) {
  const src = fs.readFileSync(path.join(catalogDir, `${kind}.ts`), "utf8");
  const chunks = src.split(/\n  \{\n/).slice(1);
  for (const chunk of chunks) {
    const id = chunk.match(/id:\s*"([^"]+)"/)?.[1];
    const label = chunk.match(/label:\s*"([^"]+)"/)?.[1];
    if (id && label) catalog.push({ kind, id, label });
  }
}

const labelsByKind = Object.fromEntries(KIND_FILES.map((k) => [k, []]));
for (const m of catalog) labelsByKind[m.kind].push([m.id, m.label]);

const effectsLines = normalizeLines(pdfText(20, 36));
const factoryLines = normalizeLines(pdfText(37, 39));

/** @type {Record<string, {label:string, kind:string, description:string, basedOn?: string, source?: string}>} */
const results = {};

// Section ranges
/** @type {Record<string, [number, number]>} */
const sectionRanges = {};
let current = null;
let startIdx = 0;
for (let idx = 0; idx < effectsLines.length; idx++) {
  const line = effectsLines[idx];
  if (SECTIONS.has(line)) {
    if (current) sectionRanges[current] = [startIdx, idx];
    current = line === "N->S" ? "N→S" : line;
    startIdx = idx + 1;
  }
}
if (current) sectionRanges[current] = [startIdx, effectsLines.length];

const SEC_KIND = {
  NR: "nr",
  PRE: "pre",
  DST: "dst",
  AMP: "amp",
  CAB: "cab",
  EQ: "eq",
  MOD: "mod",
  DLY: "dly",
  RVB: "rvb",
};

for (const [sec, kind] of Object.entries(SEC_KIND)) {
  const range = sectionRanges[sec];
  if (!range) continue;
  const secLines = effectsLines.slice(range[0], range[1]);
  const ordered = labelsByKind[kind];
  const labelsOnly = ordered.map(([, lab]) => lab);
  let i = 0;
  let found = 0;
  for (const [mid, lab] of ordered) {
    let hit = null;
    for (let j = i; j < secLines.length; j++) {
      const m = matchLabel(secLines, j, lab);
      if (m) {
        hit = { j, ...m };
        break;
      }
    }
    if (!hit) {
      console.warn(`NOT FOUND ${kind} ${lab}`);
      continue;
    }
    const stop = labelsOnly.filter((x) => x !== lab);
    if (hit.sameLineRest != null) {
      let rest = hit.sameLineRest;
      for (const tw of [...TYPE_WORDS].sort((a, b) => b.length - a.length)) {
        if (rest === tw || rest.startsWith(tw + " ")) {
          rest = rest.slice(tw.length).trim();
          break;
        }
      }
      rest = rest.split(/\s*VOL:/)[0].trim();
      const { desc: more, next } = parseDesc(secLines, hit.j + hit.consumed, stop);
      results[mid] = {
        label: lab,
        kind,
        description: cleanSpaces(`${rest} ${more}`.trim()),
      };
      i = next;
    } else {
      const { desc, next } = parseDesc(secLines, hit.j + hit.consumed, stop);
      results[mid] = { label: lab, kind, description: desc };
      i = next;
    }
    found += 1;
  }
  console.log(`${kind}: ${found}/${ordered.length}`);
}

// Factory SnapTones (NS)
const factorySkip = new Set([
  "Factory SnapTone Files",
  "Name Description",
  "Name",
  "Description",
  "Pedal",
  "Clean Amp",
  "Overdrive",
  "Amp",
  "Overdrive Amp",
  "Distortion",
  "Distortion Amp",
  "Bass Amp",
  "Acoustic",
  "Acoustic Sim",
  "Others",
  "Hi-Gain",
  "Hi-Gain Amp",
  "Bass Amp/Acoustic",
  "Bass Amp/Acoustic Sim",
]);
const ft = factoryLines.filter((l) => !factorySkip.has(l));
const nsOrdered = labelsByKind.ns;

function isNsNameAt(lines, idx) {
  for (const [mid, lab] of nsOrdered) {
    const m = matchLabel(lines, idx, lab);
    if (m) {
      if (m.sameLineRest != null && m.sameLineRest.includes("This SnapTone")) {
        return { lab, mid, m };
      }
      const after = idx + m.consumed;
      if (after < lines.length && lines[after].startsWith("This SnapTone")) {
        return { lab, mid, m };
      }
    }
    // Factory sometimes puts name + blurb on one line (e.g. "HACK BS This SnapTone…")
    const line = lines[idx];
    if (line.toLowerCase().startsWith(lab.toLowerCase() + " ") && line.includes("This SnapTone")) {
      return {
        lab,
        mid,
        m: { consumed: 1, sameLineRest: line.slice(lab.length).trim() },
      };
    }
  }
  return null;
}

let fi = 0;
let nsFound = 0;
while (fi < ft.length) {
  const hit = isNsNameAt(ft, fi);
  if (!hit) {
    fi += 1;
    continue;
  }
  const parts = [];
  let j;
  if (hit.m.sameLineRest != null) {
    parts.push(hit.m.sameLineRest);
    j = fi + hit.m.consumed;
  } else {
    j = fi + hit.m.consumed;
  }
  while (j < ft.length) {
    if (isNsNameAt(ft, j)) break;
    parts.push(ft[j]);
    j += 1;
  }
  results[hit.mid] = {
    label: hit.lab,
    kind: "ns",
    description: cleanSpaces(parts.join(" ")),
  };
  nsFound += 1;
  fi = j;
}
console.log(`ns: ${nsFound}/${nsOrdered.length}`);

// HTML title fallbacks
const html = fs.readFileSync(path.join(refDir, htmlFile), "utf8");
const htmlTitles = new Map();
for (const m of html.matchAll(/<option[^>]*\btitle="([^"]*)"[^>]*>([^<]+)<\/option>/g)) {
  htmlTitles.set(key(m[2].trim()), m[1]);
}

for (const m of catalog) {
  if (results[m.id]?.description) continue;
  const ht = htmlTitles.get(key(m.label));
  if (ht) {
    results[m.id] = { label: m.label, kind: m.kind, description: ht, source: "html" };
  }
}

for (const [id, r] of Object.entries(results)) {
  r.basedOn = extractBasedOn(r.description);
}

for (const m of catalog) {
  if (!results[m.id]) {
    results[m.id] = { label: m.label, kind: m.kind, description: "", basedOn: undefined };
  }
}

const missing = catalog.filter((m) => !results[m.id]?.description).map((m) => m.id);
console.log("missing descriptions:", missing);
console.log(
  "with basedOn:",
  Object.values(results).filter((r) => r.basedOn).length,
);

function tsString(s) {
  return JSON.stringify(s);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMetaFields(src) {
  return src
    .replace(/\n    description: "(?:\\.|[^"\\])*",/g, "")
    .replace(/\n    basedOn: "(?:\\.|[^"\\])*",/g, "");
}

// Patch each catalog file: insert description/basedOn after label line
for (const kind of KIND_FILES) {
  const filePath = path.join(catalogDir, `${kind}.ts`);
  let src = stripMetaFields(fs.readFileSync(filePath, "utf8"));
  const models = catalog.filter((m) => m.kind === kind);
  for (const m of models) {
    const r = results[m.id];
    const desc = r?.description ?? "";
    const based = r?.basedOn;
    const basedLine = based ? `\n    basedOn: ${tsString(based)},` : "";
    const insert = `\n    description: ${tsString(desc)},${basedLine}`;
    const blockRe = new RegExp(
      `id: ${escapeRegExp(tsString(m.id))},\\n    kind: "[^"]+",\\n    label: ${escapeRegExp(tsString(m.label))},`,
    );
    if (!blockRe.test(src)) {
      console.warn("patch miss", m.id);
      continue;
    }
    src = src.replace(blockRe, (match) => `${match}${insert}`);
  }
  fs.writeFileSync(filePath, src);
}

// Update types
const typesPath = path.join(catalogDir, "types.ts");
let types = fs.readFileSync(typesPath, "utf8");
if (!types.includes("description:")) {
  types = types.replace(
    `export type FxModel = {
  id: string;
  kind: EffectId;
  label: string;
  devices: ReadonlySet<DeviceModel>;
  wire: WireIdentity;
  controls: readonly FxControl[];
};`,
    `export type FxModel = {
  id: string;
  kind: EffectId;
  label: string;
  /** Manual / factory blurb for this model. */
  description: string;
  /** Named gear this model is based on, when the description identifies one. */
  basedOn?: string;
  devices: ReadonlySet<DeviceModel>;
  wire: WireIdentity;
  controls: readonly FxControl[];
};`,
  );
  fs.writeFileSync(typesPath, types);
}

fs.writeFileSync("/tmp/catalog-descs.json", JSON.stringify(results, null, 2));
console.log("Done. Wrote catalog patches + /tmp/catalog-descs.json");
