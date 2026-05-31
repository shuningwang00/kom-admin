import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMakeupNoteWithTimeFromIso,
  parseMakeupTimeFromNote,
} from "@/lib/attendance/status";

describe("makeup note time", () => {
  it("round-trips custom slot time in the note", () => {
    const note = formatMakeupNoteWithTimeFromIso("2026-05-27", "2pm");
    assert.equal(note, "MU on 27/05 · 2pm – 3:45pm");
    assert.equal(parseMakeupTimeFromNote(note), "2pm – 3:45pm");
  });
});
