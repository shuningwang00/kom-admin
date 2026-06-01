import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCancelledSessionMakeupNote,
  isCancelledSessionMakeupNote,
} from "@/lib/attendance/cancel-session";

describe("cancel session makeup note", () => {
  it("formats note with session date", () => {
    assert.equal(
      formatCancelledSessionMakeupNote("2026-06-15"),
      "M/U · cancelled session 15/06",
    );
  });

  it("detects cancelled-session notes", () => {
    assert.equal(
      isCancelledSessionMakeupNote("M/U · cancelled session 15/06"),
      true,
    );
    assert.equal(isCancelledSessionMakeupNote("MU on 20/06"), false);
  });
});
