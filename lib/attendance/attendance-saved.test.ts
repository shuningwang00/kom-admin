import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSessionAttendanceSaved,
  pickConsolidatedAttendanceRecord,
} from "@/lib/attendance/attendance-saved";

const PEER = "peer";
const HOME = "home";
const KESTER = "kester";

function row(
  sessionId: string,
  status: string,
  updatedBy: string,
) {
  return {
    sessionId,
    studentId: KESTER,
    status,
    updatedBy,
  };
}

describe("pickConsolidatedAttendanceRecord", () => {
  it("uses tutor-saved row on sibling session when opened session still has system M/U booking", () => {
    const records = [
      row(PEER, "makeup_scheduled", "system"),
      row(HOME, "present", "tutor@kom"),
    ];
    const picked = pickConsolidatedAttendanceRecord(records, KESTER, PEER);
    assert.equal(picked?.sessionId, HOME);
    assert.equal(picked?.status, "present");
    assert.equal(isSessionAttendanceSaved(picked), true);
  });

  it("prefers opened session when that row is already saved", () => {
    const records = [
      row(PEER, "present", "tutor@kom"),
      row(HOME, "makeup_scheduled", "system"),
    ];
    const picked = pickConsolidatedAttendanceRecord(records, KESTER, PEER);
    assert.equal(picked?.sessionId, PEER);
  });
});
