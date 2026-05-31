import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalTimeLabel,
  normalizeTimeLabel,
  parseTimeRange,
  resolveRescheduleTimeLabel,
} from "@/lib/scheduling/time-slots";

describe("parseTimeRange", () => {
  it("parses class sheet times with 'to'", () => {
    assert.equal(parseTimeRange("430pm to 615pm")?.timeLabel, "4:30pm – 6:15pm");
    assert.equal(
      parseTimeRange("1045am to 1230pm")?.timeLabel,
      "10:45am – 12:30pm",
    );
    assert.equal(parseTimeRange("615pm to 8pm")?.timeLabel, "6:15pm – 8pm");
  });

  it("parses en-dash session labels", () => {
    assert.equal(parseTimeRange("9am – 10:45am")?.timeLabel, "9am – 10:45am");
  });
});

describe("normalizeTimeLabel", () => {
  it("normalises KOM class.time strings", () => {
    assert.equal(normalizeTimeLabel("430pm to 615pm"), "4:30pm – 6:15pm");
  });
});

describe("canonicalTimeLabel", () => {
  it("maps sheet-style strings to en-dash slot labels", () => {
    assert.equal(canonicalTimeLabel("615pm to 8pm"), "6:15pm – 8pm");
    assert.equal(canonicalTimeLabel("9am to 1045am"), "9am – 10:45am");
  });
});

describe("resolveRescheduleTimeLabel", () => {
  it("does not fall back to 9am for afternoon class times", () => {
    assert.equal(
      resolveRescheduleTimeLabel("430pm to 615pm", "430pm to 615pm"),
      "4:30pm – 6:15pm",
    );
  });
});
