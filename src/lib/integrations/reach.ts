import { isServerless } from "@/lib/setup-check";

const PRIVATE_SUFFIXES = [".local", ".lan", ".home", ".home.arpa", ".internal", ".localdomain"];

/** Whether an address only exists inside a home network, so a server elsewhere on the internet cannot reach it. */
export function isHomeNetworkHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || !host.includes(".") && !host.includes(":")) return true;
  if (PRIVATE_SUFFIXES.some(suffix => host.endsWith(suffix))) return true;
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
  if (v4) {
    const [a, b] = v4;
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  return host === "::1" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

/** What to say when a home server cannot be reached, naming the usual cause when Hearth runs in the cloud. */
export function unreachableMessage(service: string, address: URL, serverless = isServerless()) {
  if (serverless && isHomeNetworkHost(address.hostname)) {
    return `This Hearth runs in the cloud, so it can't reach ${address.host}, which only exists on your home network. Give ${service} a public https address (Home Assistant Cloud or Tailscale Funnel), or run Hearth on a computer at home.`;
  }
  return `Could not reach ${service} at ${address.origin}. Check that it is running and that this server can reach that address.`;
}
