import type { NextConfig } from "next";

/** Hostnames other than localhost that may load the dev server, such as a phone on the LAN. `npm run dev:https` fills this in. */
const devOrigins = (process.env.HEARTH_DEV_ORIGINS ?? "").split(",").map(host => host.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: devOrigins,
  devIndicators: false,
  // The demo home's cameras read their pictures from here at request time, so a serverless build has to bring them along.
  outputFileTracingIncludes: { "/api/devices/[id]/camera": ["./public/samples/*.jpg"] },
};

export default nextConfig;
