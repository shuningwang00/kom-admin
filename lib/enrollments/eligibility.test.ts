import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectiveEnrollmentStartDate,
  isEnrollmentActiveOnDate,
  isFreeTrialOnSession,
} from "@/lib/enrollments/eligibility";

describe("enrollment start dates", () => {
  it("uses registration start when class enrollment has no startedAt", () => {
    assert.equal(
      effectiveEnrollmentStartDate(null, "2026-05-28"),
      "2026-05-28",
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-21",
        studentStartDate: "2026-05-28",
      }),
      false,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-28",
        studentStartDate: "2026-05-28",
      }),
      true,
    );
  });

  it("shows free trial pill on trial lesson date without freeTrial flag", () => {
    assert.equal(
      isFreeTrialOnSession({
        sessionDate: "2026-05-21",
        freeTrial: false,
        trialAttendedAt: "2026-05-21",
      }),
      true,
    );
    assert.equal(
      isFreeTrialOnSession({
        sessionDate: "2026-05-28",
        freeTrial: false,
        trialAttendedAt: "2026-05-21",
      }),
      false,
    );
  });

  it("allows trial lesson date before registration start", () => {
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-21",
        studentStartDate: "2026-05-28",
        trialAttendedAt: "2026-05-21",
      }),
      true,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-22",
        studentStartDate: "2026-05-28",
        trialAttendedAt: "2026-05-21",
      }),
      false,
    );
  });

  it("stays on sessions before withdrawal date only", () => {
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-20",
        studentStartDate: "2026-01-01",
        enrollmentEndedAt: "2026-05-21",
      }),
      true,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-21",
        studentStartDate: "2026-01-01",
        enrollmentEndedAt: "2026-05-21",
      }),
      false,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-05-25",
        studentStartDate: "2026-01-01",
        enrollmentEndedAt: "2026-05-21",
      }),
      false,
    );
  });

  it("uses later of registration and class start", () => {
    assert.equal(
      effectiveEnrollmentStartDate("2026-06-01", "2026-05-28"),
      "2026-06-01",
    );
  });

  it("excludes sessions during a pause window", () => {
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-06-10",
        studentStartDate: "2026-01-01",
        pauseStartedAt: "2026-06-11",
        pauseEndedAt: "2026-07-01",
      }),
      true,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-06-15",
        studentStartDate: "2026-01-01",
        pauseStartedAt: "2026-06-11",
        pauseEndedAt: "2026-07-01",
      }),
      false,
    );
    assert.equal(
      isEnrollmentActiveOnDate({
        sessionDate: "2026-07-01",
        studentStartDate: "2026-01-01",
        pauseStartedAt: "2026-06-11",
        pauseEndedAt: "2026-07-01",
      }),
      true,
    );
  });
});
