// A minimal WebSocket client over a Unix socket: the HTTP Upgrade handshake, text frames out
// (masked, as a client must send them), text, ping and close frames in. No dependencies, because
// Codex's app-server control socket speaks WebSocket over a Unix socket and Node's own WebSocket
// cannot dial one.
import { connect } from "node:net";
import { randomBytes, createHash } from "node:crypto";
export function openUdsWebSocket(path, { onMessage, onClose } = {}) {
  return new Promise((resolve, reject) => {
    const sock = connect({ path });
    const key = randomBytes(16).toString("base64");
    let buf = Buffer.alloc(0), open = false;
    sock.on("error", reject);
    sock.on("connect", () => sock.write(`GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    sock.on("close", () => onClose?.());
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      if (!open) {
        const end = buf.indexOf("\r\n\r\n"); if (end < 0) return;
        const head = buf.subarray(0, end).toString();
        const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        if (!/^HTTP\/1\.1 101/.test(head) || !head.includes(accept)) { reject(new Error(`no upgrade: ${head.split("\r\n")[0]}`)); sock.destroy(); return; }
        open = true; buf = buf.subarray(end + 4);
        resolve({ send, close: () => sock.end() });
      }
      for (;;) {
        if (buf.length < 2) return;
        const op = buf[0] & 0x0f; let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        if (buf.length < off + len) return;
        const payload = buf.subarray(off, off + len); buf = buf.subarray(off + len);
        if (op === 1) onMessage?.(payload.toString("utf8"));
        else if (op === 9) frame(10, payload);
        else if (op === 8) sock.end();
      }
    });
    function frame(op, data) {
      const mask = randomBytes(4), n = data.length;
      const head = n < 126 ? Buffer.from([0x80 | op, 0x80 | n]) : n < 65536 ? Buffer.from([0x80 | op, 0x80 | 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
      const body = Buffer.from(data); for (let i = 0; i < n; i++) body[i] ^= mask[i & 3];
      sock.write(Buffer.concat([head, mask, body]));
    }
    function send(text) { frame(1, Buffer.from(text, "utf8")); }
  });
}
