import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
let key: Buffer | undefined;

/** Derived from BETTER_AUTH_SECRET so self-hosters manage one secret; the HKDF label keeps it distinct from session signing. */
function secretKey() {
  if (key) return key;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  key = Buffer.from(hkdfSync("sha256", secret, "hearth", "integration-secrets", 32));
  return key;
}

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data].map(part => typeof part === "string" ? part : part.toString("base64url")).join(".");
}

export function unseal<T>(token: string): T {
  const [version, iv, tag, data] = token.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised sealed value");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}
