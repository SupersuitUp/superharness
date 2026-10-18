// Codex background sessions, driven against a FAKE app-server daemon on a temporary Unix socket that
// speaks what the real one does: WebSocket over the socket, one JSON-RPC message per text frame, the
// method names `codex app-server generate-json-schema` prints for 0.162.1. Never a real Codex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { connectDaemon, controlSocket, ensureDaemon, listSessions, startSession, stopSession } from "../src/codex-background.mjs";

// The server's side of WebSocket: the 101 handshake, unmasking client frames, unmasked replies.
function fakeDaemon(socketPath, answer) {
  const seen = [];
  const server = createServer((sock) => {
    let buf = Buffer.alloc(0), open = false;
    const reply = (obj) => { const b = Buffer.from(JSON.stringify(obj)); const head = b.length < 126 ? Buffer.from([0x81, b.length]) : Buffer.from([0x81, 126, b.length >> 8, b.length & 255]); sock.write(Buffer.concat([head, b])); };
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!open) {
        const end = buf.indexOf("\r\n\r\n"); if (end < 0) return;
        const key = /Sec-WebSocket-Key: (\S+)/i.exec(buf.subarray(0, end).toString())[1];
        const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
        open = true; buf = buf.subarray(end + 4);
      }
      while (buf.length >= 6) {
        const op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
        assert.ok(masked, "a client frame must be masked");
        if (buf.length < off + 4 + len) return;
        const mask = buf.subarray(off, off + 4), body = Buffer.from(buf.subarray(off + 4, off + 4 + len));
        for (let i = 0; i < len; i++) body[i] ^= mask[i & 3];
        buf = buf.subarray(off + 4 + len);
        if (op === 8) { sock.end(); return; }
        const m = JSON.parse(body.toString());
        seen.push(m);
        if (m.id != null) reply({ id: m.id, ...(answer(m) ?? { result: {} }) });
      }
    });
  });
  return new Promise((res) => server.listen(socketPath, () => res({ seen, close: () => new Promise((r) => server.close(r)) })));
}

const fresh = () => { const d = mkdtempSync("/tmp/cx-"); return { d, sock: join(d, "s.sock") }; };
const ANSWERS = (m) => ({
  "thread/start": { result: { thread: { id: "thr_1" } } },
  "turn/start": { result: { turn: { id: "turn_1", status: "inProgress" } } },
  "thread/list": { result: { data: [
    { id: "thr_1", name: "Fix it", status: { type: "active", activeFlags: [] }, cwd: "/w", originator: "superharness" },
    { id: "thr_2", name: "Old", status: { type: "idle" }, cwd: "/w", originator: "superharness" },
    { id: "thr_3", name: "Cold", status: { type: "notLoaded" }, cwd: "/w", originator: "superharness" },
    { id: "thr_4", name: "A person's chat", status: { type: "active", activeFlags: [] }, cwd: "/w", originator: "codex_desktop" },
  ] } },
  "thread/turns/list": { result: { data: m.params?.threadId === "thr_1" ? [{ id: "turn_1", status: "inProgress" }, { id: "turn_0", status: "completed" }] : [{ id: "turn_9", status: "completed" }] } },
}[m.method]);

test("start: initialize, thread/start in the folder with nobody to approve, name it, then the prompt as its first turn", async (t) => {
  const { d, sock } = fresh(); t.after(() => rmSync(d, { recursive: true, force: true }));
  const fake = await fakeDaemon(sock, ANSWERS); t.after(() => fake.close());
  const s = await startSession({ prompt: "do the thing", name: "Fix it", cwd: "/w", socket: sock });
  assert.deepEqual(s, { id: "thr_1", turnId: "turn_1", name: "Fix it" });
  assert.deepEqual(fake.seen.map((m) => m.method), ["initialize", "initialized", "thread/start", "thread/name/set", "turn/start"]);
  assert.deepEqual(fake.seen[2].params, { cwd: "/w", approvalPolicy: "never", sandbox: "workspace-write" });
  assert.deepEqual(fake.seen[3].params, { threadId: "thr_1", name: "Fix it" });
  assert.deepEqual(fake.seen[4].params, { threadId: "thr_1", input: [{ type: "text", text: "do the thing" }] });
  assert.ok(fake.seen.every((m) => !("jsonrpc" in m)), "the jsonrpc header is omitted on the wire");
});

test("list: only the sessions this module started that the daemon holds in memory, busy while a turn runs", async (t) => {
  const { d, sock } = fresh(); t.after(() => rmSync(d, { recursive: true, force: true }));
  const fake = await fakeDaemon(sock, ANSWERS); t.after(() => fake.close());
  const list = await listSessions({ socket: sock });
  assert.deepEqual(list.map((s) => [s.id, s.status]), [["thr_1", "busy"], ["thr_2", "idle"]]);
  // By originator, checked here: Codex files every app-server thread as source "vscode", and the
  // local app-server refuses an `originators` filter, so the request must not carry one.
  assert.equal(fake.seen.find((m) => m.method === "thread/list").params.originators, undefined);
  assert.equal(fake.seen.find((m) => m.method === "initialize").params.clientInfo.name, "superharness", "the originator list filters on is the name this module connects as");
});

test("stop: interrupts the turn in progress, and a session with none running is not an error", async (t) => {
  const { d, sock } = fresh(); t.after(() => rmSync(d, { recursive: true, force: true }));
  const fake = await fakeDaemon(sock, ANSWERS); t.after(() => fake.close());
  assert.deepEqual(await stopSession({ id: "thr_1", socket: sock }), { stopped: true, turnId: "turn_1" });
  assert.deepEqual(fake.seen.find((m) => m.method === "turn/interrupt").params, { threadId: "thr_1", turnId: "turn_1" });
  assert.deepEqual(await stopSession({ id: "thr_2", socket: sock }), { stopped: false, turnId: null });
});

test("a daemon error is reported with the method that failed, and the connection is closed", async (t) => {
  const { d, sock } = fresh(); t.after(() => rmSync(d, { recursive: true, force: true }));
  const fake = await fakeDaemon(sock, (m) => (m.method === "thread/start" ? { error: { message: "not signed in" } } : ANSWERS(m))); t.after(() => fake.close());
  await assert.rejects(startSession({ prompt: "x", socket: sock }), /thread\/start: not signed in/);
});

test("the daemon is started only when its socket is missing, and the socket honours CODEX_HOME", () => {
  const ran = [];
  ensureDaemon({ socket: "/s", exists: () => true, run: (...a) => ran.push(a) });
  assert.equal(ran.length, 0);
  ensureDaemon({ codex: "/bin/cx", socket: "/s", exists: () => false, run: (...a) => ran.push(a) });
  assert.deepEqual(ran[0].slice(0, 2), ["/bin/cx", ["app-server", "daemon", "start"]]);
  assert.equal(controlSocket({ CODEX_HOME: "/c" }, "/h"), "/c/app-server-control/app-server-control.sock");
  assert.equal(controlSocket({}, "/h"), "/h/.codex/app-server-control/app-server-control.sock");
});

test("the bin prints one JSON line with the session id that sessionIdFrom reads", async (t) => {
  const { d } = fresh(); t.after(() => rmSync(d, { recursive: true, force: true }));
  const home = join(d, "codex-home"); const sockDir = join(home, "app-server-control");
  execFileSync("mkdir", ["-p", sockDir]);
  const fake = await fakeDaemon(join(sockDir, "app-server-control.sock"), ANSWERS); t.after(() => fake.close());
  const bin = fileURLToPath(new URL("../bin/codex-background.mjs", import.meta.url));
  const out = await new Promise((res, rej) => import("node:child_process").then(({ execFile }) =>
    execFile(process.execPath, [bin, "start", "--name", "Fix it", "--cwd", "/w", "--", "do", "it"], { env: { ...process.env, CODEX_HOME: home } }, (e, so) => (e ? rej(e) : res(so)))));
  const line = JSON.parse(out.trim());
  assert.equal(line.ok, true);
  assert.equal(line.id, "thr_1");
  assert.equal(line.resume, "codex resume thr_1");
  const { default: codex } = await import("../src/adapters/codex.mjs");
  assert.equal(codex({}).sessionIdFrom(out), "thr_1");
});

test("the bin never exits in the same breath as a print, and a usage error still reaches the pipe", async () => {
  const { readFileSync } = await import("node:fs");
  const { spawnSync } = await import("node:child_process");
  const bin = fileURLToPath(new URL("../bin/codex-background.mjs", import.meta.url));
  const src = readFileSync(bin, "utf8");
  assert.doesNotMatch(src, /stdout\.write\([^;]*\);\s*process\.exit\(/, "exit from the write callback, so a piped line is not lost");
  const r = spawnSync(process.execPath, [bin, "bogus"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout.trim()).ok, false);
  assert.equal(r.stdout.trim().split("\n").length, 1, "one line, never a second say() after the first");
});
