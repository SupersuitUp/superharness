// Background sessions on Codex: start one nobody is watching, list the ones running, stop one.
//
// HOW. Codex 0.162 runs a shared local app-server daemon (`codex app-server daemon start`) and a
// thread started on it keeps running after the program that started it disconnects. Measured on
// 2026-10-17 with codex-cli 0.162.1: a thread was started with a turn that slept 20 seconds and then
// wrote a file, the starting program exited 8.6 seconds in, and the file appeared after it had gone.
// That is the property `claude --bg` has, reached through the daemon's JSON-RPC instead of a flag.
//
// The daemon listens on a control socket that speaks WebSocket over a Unix socket (the app-server
// documentation: "WebSocket connections over Codex's default app-server control socket ... using the
// standard HTTP Upgrade handshake"), one JSON-RPC message per text frame, with the `jsonrpc` header
// omitted. Method names are the ones `codex app-server generate-json-schema` prints for 0.162.1.
//
// Everything that touches the machine is injectable (`open`, `ensure`), so the tests drive a fake
// daemon on a temporary socket and never a real Codex.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { openUdsWebSocket } from "./uds-websocket.mjs";

/** The daemon's control socket: $CODEX_HOME/app-server-control/app-server-control.sock. */
export function controlSocket(env = process.env, home = homedir()) {
  const codexHome = typeof env.CODEX_HOME === "string" && env.CODEX_HOME.trim() ? env.CODEX_HOME.trim() : join(home, ".codex");
  return join(codexHome, "app-server-control", "app-server-control.sock");
}

/** Start the daemon when its socket is missing. `codex app-server daemon start` is a no-op when it already runs. */
export function ensureDaemon({ codex = "codex", socket, exists = existsSync, run = execFileSync } = {}) {
  if (socket && exists(socket)) return;
  run(codex, ["app-server", "daemon", "start"], { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
}

/** One JSON-RPC connection to the daemon, initialized. Resolves to { call, close }. */
export async function connectDaemon({ socket, open = openUdsWebSocket, clientName = "superharness", version = "0" } = {}) {
  let n = 0;
  const waiting = new Map();
  const ws = await open(socket, {
    onMessage: (text) => {
      let m;
      try { m = JSON.parse(text); } catch { return; }
      if (m.id == null || !waiting.has(m.id)) return;
      const w = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) w.reject(new Error(`${w.method}: ${m.error.message || JSON.stringify(m.error)}`));
      else w.resolve(m.result);
    },
    onClose: () => { for (const w of waiting.values()) w.reject(new Error(`${w.method}: the daemon closed the connection`)); waiting.clear(); },
  });
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++n;
    waiting.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await call("initialize", { clientInfo: { name: clientName, version } });
  ws.send(JSON.stringify({ method: "initialized" }));
  return { call, close: () => ws.close() };
}

/**
 * Start a background session: a thread in `cwd`, named, with `prompt` as its first turn. Returns
 * { id, turnId, name } once the turn has started; the thread runs on in the daemon after this returns.
 * `approvalPolicy` is never by default, because nobody is watching to approve anything.
 */
export async function startSession({ prompt, name, cwd, approvalPolicy = "never", sandbox = "workspace-write", model, connect = connectDaemon, socket } = {}) {
  if (!prompt) throw new Error("startSession needs a prompt");
  const rpc = await connect({ socket });
  try {
    const params = { cwd, approvalPolicy, sandbox, ...(model ? { model } : {}) };
    const st = await rpc.call("thread/start", params);
    const id = st?.thread?.id;
    if (!id) throw new Error("thread/start returned no thread id");
    if (name) await rpc.call("thread/name/set", { threadId: id, name });
    const turn = await rpc.call("turn/start", { threadId: id, input: [{ type: "text", text: prompt }] });
    return { id, turnId: turn?.turn?.id ?? null, name: name ?? null };
  } finally { rpc.close(); }
}

/** Status as a host reads it: busy while a turn runs, idle between turns, and Codex's own word otherwise. */
const statusOf = (s) => (s?.type === "active" ? "busy" : s?.type || "unknown");

/**
 * The sessions this module started that the daemon holds in memory. Codex files a thread started over
 * the app-server as source "vscode", whoever started it, so the source cannot pick them out; the
 * originator can, because it is the clientInfo name `connectDaemon` gives. Filtered here rather than
 * by `originators`, which the local app-server refuses ("originator filtering is not supported by the
 * local app-server", measured on 0.162.1).
 */
export async function listSessions({ connect = connectDaemon, socket, limit = 100, originator = "superharness" } = {}) {
  const rpc = await connect({ socket });
  try {
    const r = await rpc.call("thread/list", { limit });
    return (r?.data || [])
      .filter((t) => t?.originator === originator && t?.status?.type && t.status.type !== "notLoaded")
      .map((t) => ({ id: t.id, name: t.name ?? null, status: statusOf(t.status), cwd: t.cwd ?? null, kind: "background" }));
  } finally { rpc.close(); }
}

/** Stop a session: interrupt the turn it is running. Returns { stopped, turnId }; nothing running is not an error. */
export async function stopSession({ id, connect = connectDaemon, socket } = {}) {
  if (!id) throw new Error("stopSession needs a session id");
  const rpc = await connect({ socket });
  try {
    const turns = await rpc.call("thread/turns/list", { threadId: id, limit: 5, sortDirection: "desc" });
    const running = (turns?.data || []).find((t) => t?.status === "inProgress");
    if (!running) return { stopped: false, turnId: null };
    await rpc.call("turn/interrupt", { threadId: id, turnId: running.id });
    return { stopped: true, turnId: running.id };
  } finally { rpc.close(); }
}
