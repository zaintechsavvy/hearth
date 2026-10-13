/** What a deployment still needs before Hearth can run. Reads only environment variables, so it is safe anywhere, including the proxy. */
export interface SetupProblem {
  key: "BETTER_AUTH_SECRET" | "DATABASE_URL" | "BETTER_AUTH_URL";
  why: string;
}

/** Serverless hosts have no lasting disk, so the embedded database has nowhere to live there. */
export const isServerless = (env: NodeJS.ProcessEnv = process.env) => Boolean(env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME);

export function setupProblems(env: NodeJS.ProcessEnv = process.env): SetupProblem[] {
  const problems: SetupProblem[] = [];
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    problems.push({ key: "BETTER_AUTH_SECRET", why: "Signs sessions and encrypts stored tokens, passwords, and keys. Use a long random value and keep it forever: changing it signs everyone out and makes stored secrets unreadable." });
  }
  if (isServerless(env) && !env.DATABASE_URL) {
    problems.push({ key: "DATABASE_URL", why: "This host has no lasting disk, so Hearth needs a Postgres database, such as Neon from the Vercel Marketplace or Supabase. Use the pooled connection string." });
  }
  if (isServerless(env) && !env.BETTER_AUTH_URL) {
    problems.push({ key: "BETTER_AUTH_URL", why: "The address people open Hearth at, such as https://hearth.example.com. Sign in only accepts requests from it and from TRUSTED_ORIGINS." });
  }
  return problems;
}
