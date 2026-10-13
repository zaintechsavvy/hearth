import { describe, expect, it } from "vitest";
import { setupProblems } from "./setup-check";

const secret = "x".repeat(32);
const keys = (env: Record<string, string>) => setupProblems(env as NodeJS.ProcessEnv).map(problem => problem.key);

describe("setupProblems", () => {
  it("needs only a secret on a server with a disk", () => {
    expect(keys({})).toEqual(["BETTER_AUTH_SECRET"]);
    expect(keys({ BETTER_AUTH_SECRET: secret })).toEqual([]);
  });

  it("rejects a short secret", () => {
    expect(keys({ BETTER_AUTH_SECRET: "short" })).toEqual(["BETTER_AUTH_SECRET"]);
  });

  it("needs a database and public address on Vercel", () => {
    expect(keys({ VERCEL: "1", BETTER_AUTH_SECRET: secret })).toEqual(["DATABASE_URL", "BETTER_AUTH_URL"]);
    expect(keys({ VERCEL: "1", BETTER_AUTH_SECRET: secret, DATABASE_URL: "postgres://db", BETTER_AUTH_URL: "https://hearth.example" })).toEqual([]);
  });
});
