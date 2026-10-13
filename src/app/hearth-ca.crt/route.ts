import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * The Hearth certificate authority made by `npm run dev:https`, for a phone to download and trust. Only the public
 * certificate is served; its private key never leaves the `certs` folder. Absent when Hearth is not serving HTTPS itself.
 */
export async function GET() {
  try {
    const certificate = await readFile(resolve(/*turbopackIgnore: true*/ process.env.HEARTH_CA_PATH ?? "certs/hearth-ca.crt"));
    return new Response(certificate, { headers: { "Content-Type": "application/x-x509-ca-cert", "Content-Disposition": 'attachment; filename="hearth-ca.crt"', "Cache-Control": "no-store" } });
  } catch {
    return new Response("Hearth is not running its own HTTPS. See docs/https.md.", { status: 404 });
  }
}
