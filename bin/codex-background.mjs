#!/usr/bin/env node
// The command the Codex adapter hands a host for a background session, so a host runs one program
// and reads one line of JSON, whichever harness it is driving.
//
//   codex-background.mjs start --name <name> --cwd <dir> [--approval never] [--sandbox workspace-write] [--model <m>] [--codex <bin>] -- <prompt>
//   codex-background.mjs list [--codex <bin>]
//   codex-background.mjs stop <session-id> [--codex <bin>]
//
// Each prints one JSON object on stdout ({ ok: true, ... } or { ok: false, error }) and exits 0 or 1.
// `start` starts the daemon when it is not running; `list` and `stop` do too, so a cold machine answers.
import { controlSocket, ensureDaemon, listSessions, startSession, stopSession } from "../src/codex-background.mjs";

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const head = dash < 0 ? argv : argv.slice(0, dash);
const prompt = dash < 0 ? null : argv.slice(dash + 1).join(" ");
const flag = (f) => { const i = head.indexOf(f); return i < 0 ? null : head[i + 1] ?? null; };
// Exit only once the line has left the process: process.exit right after a write can drop it when
// stdout is a pipe, which is how every host reads this. Throwing SAID stops the verb where it is,
// and the write callback is what ends the run.
const SAID = Symbol("said");
const say = (o, code = 0) => { process.stdout.write(JSON.stringify(o) + "\n", () => process.exit(code)); throw SAID; };

const [verb] = head;
const codex = flag("--codex") || process.env.FREEDOM_CODEX_BIN || "codex";
const socket = controlSocket();
try {
  if (!["start", "list", "stop"].includes(verb)) say({ ok: false, error: "usage: codex-background.mjs start|list|stop" }, 2);
  ensureDaemon({ codex, socket });
  if (verb === "start") {
    if (!prompt) say({ ok: false, error: "start needs a prompt after --" }, 2);
    const s = await startSession({ prompt, name: flag("--name"), cwd: flag("--cwd") || process.cwd(),
      approvalPolicy: flag("--approval") || "never", sandbox: flag("--sandbox") || "workspace-write", model: flag("--model") || undefined, socket });
    say({ ok: true, ...s, resume: `codex resume ${s.id}` });
  }
  if (verb === "list") say({ ok: true, sessions: await listSessions({ socket }) });
  if (verb === "stop") {
    const id = head[1];
    if (!id || id.startsWith("-")) say({ ok: false, error: "stop needs a session id" }, 2);
    say({ ok: true, id, ...(await stopSession({ id, socket })) });
  }
} catch (e) {
  if (e !== SAID) {
    try { say({ ok: false, error: String(e?.message || e).split("\n")[0] }, 1); } catch { /* said */ }
  }
}
