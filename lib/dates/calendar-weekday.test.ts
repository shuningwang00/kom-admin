import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sessionDateMatchesClassWeekday,
  weekdayFromCalendarDate,
} from "@/lib/dates/calendar";

describe("sessionDateMatchesClassWeekday", () => {
  it("rejects Saturday class on Monday", () => {
    assert.equal(weekdayFromCalendarDate("2026-05-25"), "monday");
    assert.equal(
      sessionDateMatchesClassWeekday("2026-05-25", "saturday"),
      false,
    );
  });

  it("accepts Monday class on Monday", () => {
    assert.equal(
      sessionDateMatchesClassWeekday("2026-05-25", "monday"),
      true,
    );
  });
});
