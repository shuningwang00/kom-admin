import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEnrollmentTrialListId } from "@/lib/trials/list";

describe("trial list helpers", () => {
  it("detects enrollment-sourced converted trial ids", () => {
    assert.equal(isEnrollmentTrialListId("enrollment-abc"), true);
    assert.equal(isEnrollmentTrialListId("uuid-here"), false);
  });
});
