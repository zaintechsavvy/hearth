import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-policy";
import { googleEnabled } from "@/lib/auth-providers";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const signUpClosed = process.env.DISABLE_SIGNUP === "true";

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "").split(",").map(origin => origin.trim()).filter(Boolean);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    disableSignUp: signUpClosed,
  },
  socialProviders: googleEnabled
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, disableSignUp: signUpClosed, prompt: "select_account" } }
    : {},
  user: { deleteUser: { enabled: true } },
  session: { cookieCache: { enabled: true, maxAge: 60 * 5 } },
  plugins: [nextCookies()],
});
