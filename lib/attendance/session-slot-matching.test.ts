import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalSlotTimeLabel,
  sessionSlotConsolidationKey,
} from "@/lib/attendance/session-slot-matching";

const morningClass = {
  id: "class-am",
  level: "Sec 2 G3 Math",
  label: "S2",
  tutor: "Tutor A",
  time: "9am to 1045am",
};

const eveningClass = {
  id: "class-pm",
  level: "Sec 2 G3 Math",
  label: "S2",
  tutor: "Tutor A",
  time: "615pm to 8pm",
};

describe("canonicalSlotTimeLabel", () => {
  it("keeps class timetable when session.timeLabel was corrupted", () => {
    assert.equal(
      canonicalSlotTimeLabel({
        session: {
          id: "s1",
          scheduledDate: "2026-05-25",
          timeLabel: "9am – 10:45am",
        },
        class: eveningClass,
      }),
      "6:15pm – 8pm",
    );
  });
});

describe("sessionSlotConsolidationKey", () => {
  it("treats sheet and canonical session labels as the same slot", () => {
    const compact = sessionSlotConsolidationKey({
      session: {
        id: "s1",
        scheduledDate: "2026-05-25",
        timeLabel: "615pm to 8pm",
      },
      class: eveningClass,
    });
    const canonical = sessionSlotConsolidationKey({
      session: {
        id: "s2",
        scheduledDate: "2026-05-25",
        timeLabel: "6:15pm – 8pm",
      },
      class: eveningClass,
    });
    assert.equal(compact, canonical);
  });

  it("does not merge S2 morning and evening on the same day", () => {
    const am = sessionSlotConsolidationKey({
      session: {
        id: "s-am",
        scheduledDate: "2026-05-25",
        timeLabel: "9am – 10:45am",
      },
      class: morningClass,
    });
    const pm = sessionSlotConsolidationKey({
      session: {
        id: "s-pm",
        scheduledDate: "2026-05-25",
        timeLabel: "9am – 10:45am",
      },
      class: eveningClass,
    });
    assert.notEqual(am, pm);
  });
});
