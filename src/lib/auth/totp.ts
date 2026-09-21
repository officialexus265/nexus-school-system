/**
 * Minimal TOTP (RFC 6238) for staff 2FA — no extra npm dependency.
 */
import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += ALPHABET[parseInt(chunk, 2)]!;
  }
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const cleaned = secret.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const c of cleaned) {
    const val = ALPHABET.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(secret: string, stepMs = 30_000, digits = 6): string {
  const counter = Math.floor(Date.now() / stepMs);
  return hotp(secret, counter, digits);
}

function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32ToBuffer(secret);
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const str = String(code % 10 ** digits);
  return str.padStart(digits, "0");
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const clean = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const step = 30_000;
  const counter = Math.floor(Date.now() / step);
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, counter + w) === clean) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, email: string, issuer = "NEXUS"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(n = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    codes.push(randomBytes(4).toString("hex"));
  }
  return codes;
}
