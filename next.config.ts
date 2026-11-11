import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** The commit this build came from, shown in Settings so a screen can be checked for the latest version. */
const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? (() => {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
})();

/** Hostnames other than localhost that may load the dev server, such as a phone on the LAN. `npm run dev:https` fills this in. */
const devOrigins = (process.env.HEARTH_DEV_ORIGINS ?? "").split(",").map(host => host.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: devOrigins,
  devIndicators: false,
  env: { NEXT_PUBLIC_HEARTH_BUILD: commit.slice(0, 7) || "local" },
  // The demo home's cameras read their pictures from here at request time, so a serverless build has to bring them along.
  outputFileTracingIncludes: { "/api/devices/[id]/camera": ["./public/samples/*.jpg"] },
};

export default nextConfig;
