#!/usr/bin/env node
/**
 * Release the app: changelog entry, version numbers, commit, annotated tag, push.
 *
 * Usage:
 *   node scripts/release.mjs 0.1.2 --note "Faster reconnect"
 *   node scripts/release.mjs 1.0.0-beta.1 --note "First beta"
 *   node scripts/release.mjs 0.1.2 --note "Faster reconnect" --note "Fewer dropouts" --no-push
 *   node scripts/release.mjs --check
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const versionFiles = [
  "package.json",
  "package-lock.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
  "src-tauri/tauri.conf.json",
  "src/app/AppShell.tsx",
  "index.html",
  "src/features/about/AboutPage.tsx",
];

function printHelp() {
  console.log(`Usage:
  node scripts/release.mjs <version> --note "English changelog bullet" [--note "..."] [--no-push] [--dry-run]
  node scripts/release.mjs --check

Version is x.y.z, x.y.z-beta.N, or x.y.z-rc.N.
Updates the changelog and every app version number, commits, creates annotated tag v<version>, and pushes the branch and the tag.
--no-push stops after the local tag. --check only verifies the version numbers match.`);
}

function parseArgs(argv) {
  const notes = [];
  let version = null;
  let push = true;
  let dryRun = false;
  let check = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--note") {
      const note = argv[++i];
      if (!note) fail("--note needs a value");
      notes.push(note);
    } else if (arg === "--no-push") {
      push = false;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--check") {
      check = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      fail(`Unknown option ${arg}`);
    } else if (!version) {
      version = arg;
    } else {
      fail(`Unexpected argument ${arg}`);
    }
  }

  return { version, notes, push, dryRun, check };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, contents) {
  fs.writeFileSync(path.join(root, relativePath), contents);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitInherit(args) {
  execFileSync("git", args, { cwd: root, stdio: "inherit" });
}

const VERSION_PATTERN =
  /^(\d+)\.(\d+)\.(\d+)(?:-(beta|rc)\.(0|[1-9]\d*))?$/;

const CHANNEL_RANK = { "": 2, beta: 0, rc: 1 };

function parseSemver(version) {
  const match = VERSION_PATTERN.exec(version);
  if (!match) {
    fail(
      `Version must be x.y.z, x.y.z-beta.N, or x.y.z-rc.N, got ${version}`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    channel: match[4] ?? "",
    pre: match[5] === undefined ? -1 : Number(match[5]),
  };
}

function compareSemver(left, right) {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  if (left.channel !== right.channel) {
    return CHANNEL_RANK[left.channel] - CHANNEL_RANK[right.channel];
  }
  return left.pre - right.pre;
}

function count(haystack, needle) {
  let found = 0;
  let index = 0;
  while (needle && (index = haystack.indexOf(needle, index)) !== -1) {
    found++;
    index += needle.length;
  }
  return found;
}

function replaceExactlyOnce(label, source, from, to) {
  const found = count(source, from);
  if (found !== 1) {
    fail(
      `${label}: expected 1 occurrence of ${JSON.stringify(from)}, found ${found}`,
    );
  }
  return source.replace(from, to);
}

function currentVersion() {
  const pkg = JSON.parse(read("package.json"));
  if (!VERSION_PATTERN.test(pkg.version)) {
    fail(
      `package.json version is not x.y.z, x.y.z-beta.N, or x.y.z-rc.N: ${pkg.version}`,
    );
  }
  return pkg.version;
}

function assertVersionsInSync(version) {
  const checks = [
    [
      "package-lock.json",
      read("package-lock.json").startsWith(`{
  "name": "gpstudio",
  "version": "${version}",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "gpstudio",
      "version": "${version}",`),
    ],
    [
      "src-tauri/Cargo.toml",
      read("src-tauri/Cargo.toml").startsWith(`[package]
name = "app"
version = "${version}"
`),
    ],
    [
      "src-tauri/Cargo.lock",
      read("src-tauri/Cargo.lock").includes(`[[package]]
name = "app"
version = "${version}"
`),
    ],
    [
      "src-tauri/tauri.conf.json",
      read("src-tauri/tauri.conf.json").includes(`"version": "${version}"`),
    ],
    [
      "src/app/AppShell.tsx",
      read("src/app/AppShell.tsx").includes(`{' '}v${version}`),
    ],
    [
      "index.html",
      read("index.html").includes(`"softwareVersion": "${version}"`),
    ],
  ];

  const stale = checks.filter(([, ok]) => !ok).map(([file]) => file);
  if (stale.length > 0) {
    fail(
      `Version ${version} from package.json is missing in: ${stale.join(", ")}`,
    );
  }
}

function changelogBlock(version, notes) {
  const items = notes
    .map((note) => `      ${JSON.stringify(note)},`)
    .join("\n");
  return `  {
    version: "${version}",
    notes: [
${items}
    ],
  },
`;
}

function applyRelease(current, next, notes) {
  const lockHeader = `{
  "name": "gpstudio",
  "version": "${current}",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "gpstudio",
      "version": "${current}",`;
  const nextLockHeader = lockHeader.replaceAll(
    `"version": "${current}"`,
    `"version": "${next}"`,
  );

  write(
    "package.json",
    replaceExactlyOnce(
      "package.json",
      read("package.json"),
      `"version": "${current}"`,
      `"version": "${next}"`,
    ),
  );
  write(
    "package-lock.json",
    replaceExactlyOnce(
      "package-lock.json",
      read("package-lock.json"),
      lockHeader,
      nextLockHeader,
    ),
  );
  write(
    "src-tauri/Cargo.toml",
    replaceExactlyOnce(
      "src-tauri/Cargo.toml",
      read("src-tauri/Cargo.toml"),
      `version = "${current}"`,
      `version = "${next}"`,
    ),
  );
  write(
    "src-tauri/Cargo.lock",
    replaceExactlyOnce(
      "src-tauri/Cargo.lock",
      read("src-tauri/Cargo.lock"),
      `[[package]]
name = "app"
version = "${current}"`,
      `[[package]]
name = "app"
version = "${next}"`,
    ),
  );
  write(
    "src-tauri/tauri.conf.json",
    replaceExactlyOnce(
      "src-tauri/tauri.conf.json",
      read("src-tauri/tauri.conf.json"),
      `"version": "${current}"`,
      `"version": "${next}"`,
    ),
  );
  write(
    "src/app/AppShell.tsx",
    replaceExactlyOnce(
      "src/app/AppShell.tsx",
      read("src/app/AppShell.tsx"),
      `{' '}v${current}`,
      `{' '}v${next}`,
    ),
  );
  write(
    "index.html",
    replaceExactlyOnce(
      "index.html",
      read("index.html"),
      `"softwareVersion": "${current}"`,
      `"softwareVersion": "${next}"`,
    ),
  );

  const aboutPath = "src/features/about/AboutPage.tsx";
  const marker = `const CHANGELOG = [\n`;
  const about = read(aboutPath);
  if (count(about, marker) !== 1) {
    fail("AboutPage.tsx: CHANGELOG array not found");
  }
  if (about.includes(`version: "${next}"`)) {
    fail(`AboutPage.tsx already has Version ${next}`);
  }
  write(aboutPath, about.replace(marker, marker + changelogBlock(next, notes)));
}

function assertCleanWorktree() {
  const dirty = git(["status", "--porcelain"]).trim();
  if (dirty) {
    fail("Working tree is not clean. Commit or stash changes before releasing.");
  }
}

function assertNotBehindUpstream() {
  try {
    const behind = Number(git(["rev-list", "--count", "HEAD..@{upstream}"]).trim());
    if (behind > 0) {
      fail(`Branch is ${behind} commit(s) behind upstream. Pull before releasing.`);
    }
  } catch {
    // No upstream. The push step reports that if it matters.
  }
}

function assertTagAvailable(version) {
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`]);
  } catch {
    return;
  }
  fail(`Tag v${version} already exists`);
}

function normalizeNotes(notes) {
  return notes.map((note) => {
    const trimmed = note.trim();
    if (!trimmed) fail("Changelog notes cannot be empty");
    if (/[\r\n]/.test(trimmed)) fail("Each changelog note must be a single line");
    return trimmed;
  });
}

const { version, notes, push, dryRun, check } = parseArgs(process.argv.slice(2));
const current = currentVersion();
assertVersionsInSync(current);

if (check) {
  console.log(`Version ${current} is in sync.`);
  process.exit(0);
}

if (!version) {
  printHelp();
  fail("Missing version");
}

const nextNotes = normalizeNotes(notes);
if (nextNotes.length === 0) fail("Pass at least one --note");
if (compareSemver(parseSemver(version), parseSemver(current)) <= 0) {
  fail(`Version ${version} must be greater than ${current}`);
}
assertTagAvailable(version);

console.log(`Release ${current} → ${version}`);
console.log("Changelog:");
for (const note of nextNotes) console.log(`- ${note}`);
console.log(`Tag: v${version}`);
console.log(push ? "Push: branch and tag" : "Push: no");

if (dryRun) {
  console.log("Dry run; no files or git refs changed.");
  process.exit(0);
}

assertCleanWorktree();
assertNotBehindUpstream();
applyRelease(current, version, nextNotes);
assertVersionsInSync(version);

gitInherit(["add", "--", ...versionFiles]);
gitInherit([
  "commit",
  "-m",
  `feat: release ${version}`,
  "-m",
  nextNotes.map((note) => `- ${note}`).join("\n"),
]);
gitInherit([
  "tag",
  "-a",
  `v${version}`,
  "-m",
  `Versión ${version} - ${nextNotes[0]}`,
  "-m",
  nextNotes.map((note) => `- ${note}`).join("\n"),
]);

if (push) {
  gitInherit(["push", "origin", "HEAD"]);
  gitInherit(["push", "origin", `v${version}`]);
}

console.log(`Released v${version}`);
