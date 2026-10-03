import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Repair passcodes: AES-256-GCM, key from PASSCODE_ENCRYPTION_KEY (base64, 32
// bytes). Ciphertext is stored in repair_jobs.passcode_enc and purged by the
// database on handover (deliver_repair_job / close_repair_unrepaired).

function key(): Buffer {
  const k = Buffer.from(process.env.PASSCODE_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("PASSCODE_ENCRYPTION_KEY must be 32 bytes (base64)");
  return k;
}

export function encryptPasscode(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptPasscode(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("unknown passcode format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
