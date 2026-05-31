import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isHiddenFromSessionAttendance,
  isMissedLessonWithScheduledMakeup,
  isMuLessonAttendee,
  isWaivedOnSession,
} from "@/lib/attendance/makeup-session-rules";
import { formatSessionExpectedLabel } from "@/lib/attendance/session-expected-labels";
import {
  computeConsolidatedSlotHeadcount,
  computeSessionHeadcount,
} from "@/lib/attendance/session-headcount";
import { formatExpectedAttendancePreview } from "@/lib/attendance/session-expected-labels";
import type { AttendanceStatus } from "@/lib/attendance/status";

const DATE_25 = "2026-05-25";
const DATE_27 = "2026-05-27";
const PEER_SESSION = "peer-session";
const HOME_SESSION = "home-session";
const JACOB = "jacob";
const KESTER = "kester";
const SKYLER = "skyler";

function record(
  status: AttendanceStatus,
  makeupNote: string,
  updatedBy = "owner@site",
) {
  return { status, makeupNote, updatedBy };
}

describe("makeup session rules (billing-adjacent)", () => {
  it("M/U lesson day is not a missed-lesson link on that date", () => {
    assert.equal(
      isMuLessonAttendee(DATE_25, "present", "MU on 25/05"),
      true,
    );
    assert.equal(
      isMissedLessonWithScheduledMakeup(DATE_25, "makeup_done", "MU on 27/05"),
      true,
    );
    assert.equal(
      isMissedLessonWithScheduledMakeup(DATE_25, "makeup_done", "MU on 25/05"),
      false,
    );
  });

  it("Jacob on 25/05 with MU on 27/05 is hidden (marks on 27/05 instead)", () => {
    assert.equal(
      isHiddenFromSessionAttendance(
        JACOB,
        PEER_SESSION,
        DATE_25,
        "makeup_done",
        false,
        new Map(),
        "MU on 27/05",
      ),
      true,
    );
  });

  it("hides same-day regular slot when M/U is on another session that day", () => {
    const bookings = new Map([
      [
        KESTER,
        [
          {
            sessionId: "mu-session",
            scheduledDate: DATE_25,
            makeupNote: "MU on 25/05",
          },
        ],
      ],
    ]);
    assert.equal(
      isHiddenFromSessionAttendance(
        KESTER,
        "regular-session",
        DATE_25,
        "absent_pending",
        false,
        bookings,
        "",
      ),
      true,
    );
  });

  it("regular lessons before an M/U date are not hidden by that booking", () => {
    const bookings = new Map([
      [
        KESTER,
        [
          {
            sessionId: "mu-session",
            scheduledDate: "2026-05-25",
            makeupNote: "MU on 25/05",
          },
        ],
      ],
    ]);
    assert.equal(
      isHiddenFromSessionAttendance(
        KESTER,
        "regular-session",
        "2026-05-16",
        "absent_pending",
        false,
        bookings,
        "",
      ),
      false,
    );
  });

  it("trial lesson date is not hidden by a later M/U booking", () => {
    const bookings = new Map([
      [
        KESTER,
        [
          {
            sessionId: "other-session",
            scheduledDate: "2026-05-25",
            makeupNote: "MU on 25/05",
          },
        ],
      ],
    ]);
    assert.equal(
      isHiddenFromSessionAttendance(
        KESTER,
        "trial-session",
        "2026-05-02",
        "absent_pending",
        false,
        bookings,
        "",
        "2026-05-02",
      ),
      false,
    );
  });
});

describe("waived students", () => {
  it("are excluded from expected and students to mark", () => {
    const waiveOnSession = new Set(["only"]);
    const { expected, studentsToMark } = computeSessionHeadcount({
      sessionId: "s1",
      sessionDate: "2026-05-30",
      roster: [{ studentId: "only", freeTrial: false }],
      sessionRecords: new Map([
        ["only", record("waive", "", "staff@kom")],
      ]),
      waiveOnSession,
      bookingsByStudent: new Map(),
    });
    assert.equal(studentsToMark.length, 0);
    assert.equal(expected.regular + expected.trial + expected.makeup, 0);
    assert.equal(
      formatSessionExpectedLabel(expected, waiveOnSession.size),
      "0 expected · 1 waived",
    );
    assert.equal(isWaivedOnSession("only", waiveOnSession, "waive"), true);
  });
});

describe("computeSessionHeadcount", () => {
  it("preview count matches students to mark", () => {
    const sessionRecords = new Map([
      [JACOB, record("makeup_done", "MU on 27/05")],
      [KESTER, record("present", "MU on 25/05")],
    ]);
    const { expected, studentsToMark } = computeSessionHeadcount({
      sessionId: PEER_SESSION,
      sessionDate: DATE_25,
      roster: [{ studentId: JACOB, freeTrial: false }],
      sessionRecords,
      waiveOnSession: new Set(),
      bookingsByStudent: new Map(),
    });
    assert.equal(formatExpectedAttendancePreview(expected), "1 M/U expected");
    assert.deepEqual(studentsToMark, [KESTER]);
  });
});

describe("computeConsolidatedSlotHeadcount — S2 25/05 peer + home merge", () => {
  it("only Kester M/U; not Skyler from home roster; not Jacob missed-link", () => {
    const recordsBySession = new Map([
      [
        PEER_SESSION,
        new Map([
          [JACOB, record("makeup_done", "MU on 27/05")],
          [KESTER, record("present", "MU on 25/05")],
        ]),
      ],
      [
        HOME_SESSION,
        new Map([
          [KESTER, record("makeup_scheduled", "MU on 25/05")],
          [SKYLER, record("absent_pending", "")],
        ]),
      ],
    ]);

    const { expected, studentsToMark } = computeConsolidatedSlotHeadcount({
      sessionDate: DATE_25,
      primarySessionId: PEER_SESSION,
      primaryRoster: [{ studentId: JACOB, freeTrial: false }],
      recordsBySession,
      bookingsByStudent: new Map(),
    });

    assert.equal(formatExpectedAttendancePreview(expected), "1 M/U expected");
    assert.deepEqual(studentsToMark, [KESTER]);
    assert.ok(!studentsToMark.includes(SKYLER));
    assert.ok(!studentsToMark.includes(JACOB));
  });

});

describe("computeConsolidatedSlotHeadcount — Jacob on 27/05", () => {
  it("host roster shows Jacob as M/U on his lesson day", () => {
    const { expected, studentsToMark } = computeConsolidatedSlotHeadcount({
      sessionDate: DATE_27,
      primarySessionId: PEER_SESSION,
      primaryRoster: [{ studentId: JACOB, freeTrial: false }],
      recordsBySession: new Map([
        [PEER_SESSION, new Map([[JACOB, record("present", "MU on 27/05")]])],
      ]),
      bookingsByStudent: new Map(),
    });

    assert.equal(formatExpectedAttendancePreview(expected), "1 M/U expected");
    assert.deepEqual(studentsToMark, [JACOB]);
  });
});
