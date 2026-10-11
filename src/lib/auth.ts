import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: process.env.DISABLE_SIGNUP === "true",
  },
  user: { deleteUser: { enabled: true } },
  session: { cookieCache: { enabled: true, maxAge: 60 * 5 } },
  plugins: [nextCookies()],
});
