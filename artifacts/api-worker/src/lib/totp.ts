const APP_NAME = "TryNex Admin";
const TOTP_STEP = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(encoded: string): Uint8Array {
  const clean = encoded.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

async function hotp(key: Uint8Array, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  const view = new DataView(msg.buffer);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);
  const hmac = await hmacSha1(key, msg);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(code % Math.pow(10, TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

async function totpAt(secret: string, timeSeconds: number): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(timeSeconds / TOTP_STEP);
  return hotp(key, counter);
}

export function generateTotpSecret(): string {
  const buf = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(buf);
}

export function generateTotpUri(secret: string, username: string): string {
  const label = encodeURIComponent(`${APP_NAME}:${username}`);
  const params = new URLSearchParams({
    secret,
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export async function generateTotpQr(secret: string, username: string): Promise<string> {
  const uri = generateTotpUri(secret, username);
  try {
    const QRCode = await import("qrcode");
    const svg = await (QRCode.default as any).toString(uri, { type: "svg" });
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    return `data:text/plain;base64,${btoa(uri)}`;
  }
}

export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  const code = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const expected = await totpAt(secret, now + delta * TOTP_STEP);
    if (expected === code) return true;
  }
  return false;
}
