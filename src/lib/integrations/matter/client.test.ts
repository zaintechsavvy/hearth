import { describe, expect, it } from "vitest";
import { parseMessage, serializeMessage } from "./client";

describe("Matter wire format", () => {
  it("round trips ids that do not fit a double", () => {
    const parsed = parseMessage('{"node_id":18446744073709551615,"small":3}') as { node_id: bigint; small: number };
    expect(parsed.node_id).toBe(18446744073709551615n);
    expect(parsed.small).toBe(3);
    expect(serializeMessage({ node_id: parsed.node_id })).toBe('{"node_id":18446744073709551615}');
  });
});
