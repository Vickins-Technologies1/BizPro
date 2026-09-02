import assert from "node:assert/strict";
import { getNextBusinessOperationStatus, isBusinessOperationStatusTransitionAllowed } from "../../../packages/shared/src/operations.ts";

function main() {
  assert.equal(getNextBusinessOperationStatus("open"), "preparing");
  assert.equal(getNextBusinessOperationStatus("preparing"), "ready");
  assert.equal(getNextBusinessOperationStatus("ready"), "completed");
  assert.equal(getNextBusinessOperationStatus("confirmed"), "in_progress");
  assert.equal(isBusinessOperationStatusTransitionAllowed("open", "preparing"), true);
  assert.equal(isBusinessOperationStatusTransitionAllowed("open", "completed"), false);
  assert.equal(isBusinessOperationStatusTransitionAllowed("ready", "cancelled"), true);
  console.log("business operations lifecycle smoke passed");
}

main();
