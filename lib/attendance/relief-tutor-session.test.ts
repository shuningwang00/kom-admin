import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sessionActiveExpectedTotal,
  sessionShowsReliefTutorNeeded,
} from "@/lib/attendance/relief-tutor-session";
import { RELIEF_TUTOR_NEEDED_VALUE } from "@/lib/tutors/constants";

describe("sessionShowsReliefTutorNeeded", () => {
  it("is false when expected is 0 even if relief sentinel is set", () => {
    assert.equal(
      sessionShowsReliefTutorNeeded(RELIEF_TUTOR_NEEDED_VALUE, {
        regular: 0,
        trial: 0,
        makeup: 0,
      }),
      false,
    );
  });

  it("is true when expected students and sentinel is set", () => {
    assert.equal(
      sessionShowsReliefTutorNeeded(RELIEF_TUTOR_NEEDED_VALUE, {
        regular: 2,
        trial: 0,
        makeup: 0,
      }),
      true,
    );
  });

  it("counts makeup in active expected", () => {
    assert.equal(
      sessionActiveExpectedTotal({ regular: 0, trial: 0, makeup: 1 }),
      1,
    );
  });
});
