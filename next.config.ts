import type { NextConfig } from "next";

/** Hostnames other than localhost that may load the dev server, such as a phone on the LAN. `npm run dev:https` fills this in. */
const devOrigins = (process.env.HEARTH_DEV_ORIGINS ?? "").split(",").map(host => host.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: devOrigins,
  /** Migrations are read at startup by path, which file tracing cannot see; serverless hosts such as Vercel only ship traced files. */
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
};

export default nextConfig;
