import assert from "node:assert/strict";
import test from "node:test";
import { findPostmarkEvidence } from "../src/evidence.ts";
import { RETRYABLE_FAILURE_CODES } from "../src/retry-policy.ts";

const tracking = "9207-1902";

test("accepts one scoped timeline event for the requested tracking record", () => {
  assert.deepEqual(
    findPostmarkEvidence(
      ["Accepted at postal service Facility\nOakland CA\nMay 1, 2026"],
      "Tracking Number 9207 1902\nLatest Update\nDelivered",
      tracking,
    ),
    {
      postmarkEvent: "Accepted at postal service Facility Oakland CA May 1, 2026",
      latestStatus: "Delivered",
    },
  );
});

test("does not treat explanatory body text as a timeline event", () => {
  assert.equal(
    findPostmarkEvidence(
      ["Pre-Shipment Info Sent to postal service"],
      "Tracking Number 92071902\nHelp: postal service in possession of item means accepted",
      tracking,
    ),
    null,
  );
});

test("rejects another tracking record and ambiguous acceptance events", () => {
  assert.equal(
    findPostmarkEvidence(
      ["Accepted at postal service Facility"],
      "Tracking Number 11111111",
      tracking,
    ),
    null,
  );
  assert.equal(
    findPostmarkEvidence(
      ["Accepted at postal service Facility", "postal service in possession of item"],
      "Tracking Number 92071902",
      tracking,
    ),
    null,
  );
});

test("retry policy includes exhausted widgets and excludes missing evidence", () => {
  assert.equal(RETRYABLE_FAILURE_CODES.has("tracking_widget_timeout"), true);
  assert.equal(RETRYABLE_FAILURE_CODES.has("postmark_not_found"), false);
  assert.equal(RETRYABLE_FAILURE_CODES.has("tracking_not_found"), false);
});
