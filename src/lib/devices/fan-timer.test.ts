import { describe, expect, it } from "vitest";
import { FAN_MARKS, FAN_STOPS, UNTIL_OFF, fanStopLabel, fanStopMark, nearestFanIndex } from "./fan-timer";

describe("the fan timer's stops", () => {
  it("runs from ten minutes to twelve hours, then until it is turned off", () => {
    expect(FAN_STOPS).toEqual([10, 20, 30, 40, 50, 60, 120, 240, 480, 720, null]);
    expect(fanStopLabel(4)).toBe("50 min");
    expect(fanStopLabel(UNTIL_OFF)).toBe("Until I turn it off");
  });

  it("labels 10m, 1h, 4h, 12h and the open end", () => {
    expect(FAN_MARKS.map(fanStopMark)).toEqual(["10m", "1h", "4h", "12h", "∞"]);
  });

  it("opens at the timed stop nearest the time left", () => {
    expect(nearestFanIndex(28)).toBe(2);
    expect(nearestFanIndex(700)).toBe(9);
  });
});
