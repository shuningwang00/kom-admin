import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAutomaticAttendanceRepairEnabled,
  isStaffSavedAttendanceActor,
} from "@/lib/attendance/data-preservation";

describe("data preservation", () => {
  it("treats tutor and owner saves as staff data", () => {
    assert.equal(isStaffSavedAttendanceActor("owner@site"), true);
    assert.equal(isStaffSavedAttendanceActor("zining@kom"), true);
  });

  it("does not treat system actors as staff saves", () => {
    assert.equal(isStaffSavedAttendanceActor("system"), false);
    assert.equal(isStaffSavedAttendanceActor("system-repair"), false);
  });

  it("disables automatic repair by default", () => {
    const prev = process.env.ATTENDANCE_AUTO_REPAIR;
    delete process.env.ATTENDANCE_AUTO_REPAIR;
    assert.equal(isAutomaticAttendanceRepairEnabled(), false);
    process.env.ATTENDANCE_AUTO_REPAIR = prev;
  });
});
