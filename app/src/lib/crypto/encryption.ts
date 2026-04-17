const ALGO = "AES-GCM";

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );

  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...result));
}

export async function decrypt(encryptedBase64: string, password: string): Promise<string> {
  const dec = new TextDecoder();
  const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  return dec.decode(plaintext);
}

export function generateAgreementHash(data: {
  lender: string;
  borrower: string;
  amount: number;
  terms: string;
  timestamp: number;
}): Promise<string> {
  const enc = new TextEncoder();
  const payload = JSON.stringify(data);
  return crypto.subtle.digest("SHA-256", enc.encode(payload)).then(
    buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
  );
}
