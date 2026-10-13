// Where the `claude` binary is, for anything that spawns it OUTSIDE a terminal.
//
// In a terminal `claude` is on PATH and a bare name works. Under launchd it is not: the native
// installer puts the binary at ~/.local/bin/claude, and launchd's PATH is the six system
// directories plus whatever a plist adds. The Helm server runs under launchd, so on 2026-09-20
// the hub brain's "start a session on it" reached spin-up with a bare `claude` and died with
// ENOENT, which the brain read aloud to the operator as "couldn't find the claude binary".
// The schedule runner had already met this and passes FREEDOM_CLAUDE_BIN by hand; the board's
// model call had its own copy of this list. One resolver, so a third caller cannot repeat it.
//
// Never a versioned path under ~/.local/share/claude/versions: that moves on every update.
// ~/.local/bin/claude is the symlink the installer keeps current.
//
// A LEFTOVER COPY IS NOT A FALLBACK, IT IS THE ONE THAT RUNS (freedom#242).
// Until 2026-09-23 this returned the first path that EXISTED, with no
// nvm location in the list and no comparison of what each copy held. On a Mac carrying a current
// nvm install (2.1.280) and an npm global left over from March at /usr/local/bin/claude (2.1.88),
// the March one won: the setup check reported "Claude Code 2.1.88 is installed" every session and
// the Next Step homework job RAN 2.1.88. `claude update` could not clear it, because it updates
// the other copy, and nothing on screen named the file being read, so there was nothing to
// diagnose from.
//
// So: nvm is a candidate, and when more than one copy exists the HIGHEST VERSION wins. The
// version probe only runs when there is a real choice to make, which on almost every machine is
// never, so the common case still costs one existsSync per candidate and spawns nothing.
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// Moved verbatim from Freedom's freedom-claude-bin.mjs (v6.29.0). The one change: `userHome` was
// imported from Freedom's workspace module there and is defined here, with the same body, so this
// package depends on nothing.
const userHome = () => process.env.FREEDOM_HOME || homedir();

/** Node versions under ~/.nvm, newest first, so a current install outranks an abandoned one. */
function nvmCandidates(home, exists, list) {
  const root = join(home, ".nvm", "versions", "node");
  let names = [];
  try { names = list(root); } catch { return []; }
  return names
    .filter((n) => /^v\d/.test(n))
    .sort((a, b) => cmpV(b.slice(1), a.slice(1)))
    .map((n) => join(root, n, "bin", "claude"))
    .filter((p) => exists(p));
}

/**
 * Where a package manager puts `claude`: Homebrew on Apple Silicon, then Homebrew on Intel and an
 * npm global. Named once, because these are the two directories an agent session's PATH most
 * often LACKS: Claude Code installed by Homebrew alone, under a session whose PATH had no
 * /opt/homebrew/bin, read as "the claude binary cannot be found" while `claude` ran in the
 * terminal (Freedom v6.29.1, freedom-dev#586). A resolver that keeps its own order probes these
 * before it gives up.
 */
export const SYSTEM_CLAUDE_PATHS = ["/opt/homebrew/bin/claude", "/usr/local/bin/claude"];

export const CANDIDATES = (home = homedir(), { exists = existsSync, list = readdirSync } = {}) => [
  join(home, ".freedom", "bin", "claude-current"),
  join(home, ".local", "bin", "claude"),
  ...nvmCandidates(home, exists, list),
  ...SYSTEM_CLAUDE_PATHS,
].filter((p, i, a) => a.indexOf(p) === i);

/** Compare two dotted versions. Positive when `a` is newer. Unreadable sorts oldest. */
export function cmpV(a, b) {
  const p = (v) => String(v || "").split(".").map((n) => parseInt(n, 10) || 0);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

/** What `<path> --version` reports, or null when it cannot be run. */
export function claudeVersion(path, { run = execFileSync } = {}) {
  try {
    const out = String(run(path, ["--version"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }));
    return out.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
  } catch { return null; }
}

/** Every copy of claude on this machine, newest first. The fact an operator could not see. */
export function claudeInstalls({ home = homedir(), exists = existsSync, list = readdirSync, version = claudeVersion } = {}) {
  const real = CANDIDATES(home, { exists, list }).filter((p) => exists(p));
  return real
    .map((path) => ({ path, version: version(path) }))
    .sort((a, b) => cmpV(b.version, a.version));
}

/** Where an operator PINS a binary. A pin is a decision, so it wins outright, like the env var. */
export const pinnedPath = (home = userHome()) => join(home, ".freedom", "bin", "claude-current");

/**
 * The best copy to spawn, with the path, so a row can name what it read.
 *
 * THE PIN WINS, AND IT IS KEPT CURRENT RATHER THAN OUTRANKED. ~/.freedom/bin/claude-current is
 * Freedom's stable path for the Full Disk Access grant (`pinnedBin` in freedom-timer.mjs), and the
 * timers and the overnight pass all reach for it first. It is re-pointed at the current install
 * on every session start and every converge (`repinIfPresent`), so the resolver can keep
 * honouring it; a stale one is drift the claude-code row reports as AUTO (2026-09-24).
 *
 * Everything else is ranked by VERSION rather than by position in the list, which is the defect
 * in freedom#242: a leftover npm global from March outranked a current nvm install purely by
 * sitting earlier in a fixed array.
 */
export function bestClaudeBin({ env = process.env, home = homedir(), exists = existsSync, list = readdirSync, version = claudeVersion } = {}) {
  if (env.FREEDOM_CLAUDE_BIN) return { path: env.FREEDOM_CLAUDE_BIN, version: null, installs: [], pinned: false };
  const real = CANDIDATES(home, { exists, list }).filter((p) => exists(p));
  if (!real.length) return { path: "claude", version: null, installs: [], pinned: false };
  // ONE INSTALL NEEDS NO PROBE. The choice only exists when there is more than one copy, so the
  // machine that has never had this problem never pays for the check.
  if (real.length === 1) return { path: real[0], version: null, installs: [{ path: real[0], version: null }], pinned: real[0] === pinnedPath(home) };
  const installs = real.map((path) => ({ path, version: version(path) })).sort((a, b) => cmpV(b.version, a.version));
  const pin = installs.find((i) => i.path === pinnedPath(home));
  if (pin) return { path: pin.path, version: pin.version, installs, pinned: true };
  return { path: installs[0].path, version: installs[0].version, installs, pinned: false };
}

/** The path to spawn. `FREEDOM_CLAUDE_BIN` wins; then the newest copy on disk; else the bare name. */
export function claudeBin(opts = {}) {
  return bestClaudeBin(opts).path;
}

/** The directories a launchd PATH needs so a bare `claude` (and `node`) resolve under it. */
export function launchdPathDirs({ home = homedir() } = {}) {
  return [join(home, ".freedom", "bin"), join(home, ".local", "bin")];
}
