// Runs Hearth over HTTPS on the local network, so phones can install it and receive alerts.
// Makes a private certificate authority once (certs/hearth-ca.crt, which a phone trusts once), then a server
// certificate for every address this computer answers on, reissued when an address changes or it nears expiry.
// Nothing is added to this computer's own keychain.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, networkInterfaces } from "node:os";
import { join } from "node:path";

const DIR = "certs";
const CA_KEY = join(DIR, "hearth-ca.key");
const CA = join(DIR, "hearth-ca.crt");
const KEY = join(DIR, "hearth.key");
const CERT = join(DIR, "hearth.crt");
const NAMES = join(DIR, "names.json");
const PORT = process.env.PORT ?? "3000";
/** Phones refuse server certificates valid for longer than 825 days; a year is the safe choice. */
const SERVER_DAYS = 397;
const RENEW_DAYS = 30;

const openssl = (...args) => execFileSync("openssl", args, { stdio: ["ignore", "pipe", "pipe"] }).toString();

function localName() {
  try {
    return `${execFileSync("scutil", ["--get", "LocalHostName"]).toString().trim()}.local`;
  } catch {
    return `${hostname().replace(/\.local$/, "")}.local`;
  }
}

/** Wi-Fi and Ethernet first, so the address a phone should use comes first; VPN and carrier ranges last. */
function lanAddresses() {
  const entries = Object.entries(networkInterfaces()).flatMap(([name, list]) => (list ?? []).filter(item => item.family === "IPv4" && !item.internal).map(item => ({ name, address: item.address })));
  const rank = ({ name, address }) => (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(address) ? 2 : 0) + (/^(en|eth|wl)/.test(name) ? 0 : 1);
  return entries.sort((a, b) => rank(a) - rank(b)).map(entry => entry.address);
}

function addresses() {
  const ips = lanAddresses();
  const extra = (process.env.HEARTH_HOSTS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  return { dns: [...new Set(["localhost", localName(), ...extra.filter(value => !/^\d+\.\d+\.\d+\.\d+$/.test(value))])], ip: [...new Set(["127.0.0.1", ...ips, ...extra.filter(value => /^\d+\.\d+\.\d+\.\d+$/.test(value))])] };
}

function ensureAuthority() {
  if (existsSync(CA) && existsSync(CA_KEY)) return false;
  mkdirSync(DIR, { recursive: true });
  const config = join(DIR, "ca.cnf");
  writeFileSync(config, [
    "[req]", "distinguished_name = dn", "x509_extensions = ca", "prompt = no",
    "[dn]", "CN = Hearth local certificate authority", "O = Hearth",
    "[ca]", "basicConstraints = critical, CA:TRUE, pathlen:0", "keyUsage = critical, keyCertSign, cRLSign", "subjectKeyIdentifier = hash",
  ].join("\n"));
  openssl("genrsa", "-out", CA_KEY, "2048");
  openssl("req", "-x509", "-new", "-key", CA_KEY, "-sha256", "-days", "3650", "-config", config, "-out", CA);
  rmSync(config);
  return true;
}

function serverCertNeeded(names) {
  if (!existsSync(CERT) || !existsSync(KEY) || !existsSync(NAMES)) return true;
  if (readFileSync(NAMES, "utf8") !== JSON.stringify(names)) return true;
  try {
    openssl("x509", "-checkend", String(RENEW_DAYS * 86_400), "-noout", "-in", CERT);
    return false;
  } catch {
    return true;
  }
}

function issue(names) {
  const config = join(DIR, "server.cnf");
  const request = join(DIR, "server.csr");
  const san = [...names.dns.map((name, index) => `DNS.${index + 1} = ${name}`), ...names.ip.map((ip, index) => `IP.${index + 1} = ${ip}`)];
  writeFileSync(config, [
    "[req]", "distinguished_name = dn", "prompt = no", "[dn]", `CN = ${names.dns[1]}`,
    "[server]", "basicConstraints = critical, CA:FALSE", "keyUsage = critical, digitalSignature, keyEncipherment", "extendedKeyUsage = serverAuth",
    "subjectAltName = @names", "authorityKeyIdentifier = keyid", "[names]", ...san,
  ].join("\n"));
  openssl("genrsa", "-out", KEY, "2048");
  openssl("req", "-new", "-key", KEY, "-config", config, "-out", request);
  openssl("x509", "-req", "-in", request, "-CA", CA, "-CAkey", CA_KEY, "-CAcreateserial", "-days", String(SERVER_DAYS), "-sha256", "-extfile", config, "-extensions", "server", "-out", CERT);
  rmSync(config);
  rmSync(request);
  writeFileSync(NAMES, JSON.stringify(names));
}

const madeAuthority = ensureAuthority();
const names = addresses();
if (serverCertNeeded(names)) issue(names);

const origins = [...names.dns, ...names.ip].map(name => `https://${name}:${PORT}`);
const trusted = [...new Set([...(process.env.TRUSTED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean), ...origins])].join(",");
const phone = `https://${names.ip[1] ?? names.dns[1]}:${PORT}`;

console.log(`
Hearth over HTTPS
  On this computer: https://localhost:${PORT}
  On your phone:    ${phone}   (or https://${names.dns[1]}:${PORT} where the network allows .local names)
${madeAuthority ? "\n  A new Hearth certificate authority was made. Trust it once on each phone (see docs/https.md):" : "\n  Phones that trust the Hearth certificate authority connect without warnings. New phone? See docs/https.md:"}
    1. On the phone, open ${phone}/hearth-ca.crt and allow the download.
    2. iPhone: Settings, Profile Downloaded, Install. Then General, About, Certificate Trust Settings, turn on Hearth.
       Android: Settings, Security, Encryption and credentials, Install a certificate, CA certificate.
    3. Open ${phone}, Share, Add to Home Screen, open Hearth from the Home Screen, then turn on alerts in Settings.
`);

const child = spawn("npx", ["next", "dev", "--port", PORT, "--experimental-https", "--experimental-https-key", KEY, "--experimental-https-cert", CERT], {
  stdio: "inherit",
  env: { ...process.env, TRUSTED_ORIGINS: trusted, HEARTH_DEV_ORIGINS: [...names.dns, ...names.ip].join(",") },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
