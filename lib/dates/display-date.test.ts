import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDisplayDate } from "@/lib/dates/display-date";

describe("formatDisplayDate", () => {
  it("formats ISO dates as DD-MM-YYYY", () => {
    assert.equal(formatDisplayDate("2026-05-28"), "28-05-2026");
    assert.equal(formatDisplayDate("2026-05-21"), "21-05-2026");
  });

  it("returns fallback for empty values", () => {
    assert.equal(formatDisplayDate(null), "—");
    assert.equal(formatDisplayDate("", "n/a"), "n/a");
  });
});
