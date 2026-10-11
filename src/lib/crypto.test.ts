import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => { process.env.BETTER_AUTH_SECRET = "test-secret-that-is-long-enough-for-tests"; });

describe("seal", () => {
  it("round trips and never stores plaintext", async () => {
    const { seal, unseal } = await import("./crypto");
    const token = seal({ token: "hunter2" });
    expect(token).not.toContain("hunter2");
    expect(unseal(token)).toEqual({ token: "hunter2" });
  });

  it("rejects tampered values", async () => {
    const { seal, unseal } = await import("./crypto");
    const [version, iv, tag, data] = seal("x").split(".");
    const flipped = `${data[0] === "A" ? "B" : "A"}${data.slice(1)}`;
    expect(() => unseal([version, iv, tag, flipped].join("."))).toThrow();
  });
});
