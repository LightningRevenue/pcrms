import assert from "node:assert/strict";
import { normalizeValue, normalizeProbability, resolveLostReason } from "./deal-fields";

// Amounts: whole units, never negative, never NaN from a blank input.
assert.equal(normalizeValue(1500), 1500);
assert.equal(normalizeValue(1500.6), 1501);
assert.equal(normalizeValue(-50), 0);
assert.equal(normalizeValue(Number.NaN), 0);
assert.equal(normalizeValue(Number.POSITIVE_INFINITY), 0);

// Probability: clamped to 0-100, null means "inherit the stage's".
assert.equal(normalizeProbability(null), null);
assert.equal(normalizeProbability(Number.NaN), null);
assert.equal(normalizeProbability(60), 60);
assert.equal(normalizeProbability(140), 100);
assert.equal(normalizeProbability(-10), 0);
assert.equal(normalizeProbability(33.4), 33);

// Lost reason is only ever kept on a lost stage.
assert.equal(resolveLostReason("lost", "Price", null), "Price");
assert.equal(resolveLostReason("lost", "  Price  ", null), "Price");
// Prompt cancelled / left blank on a lost move keeps whatever was already there.
assert.equal(resolveLostReason("lost", "", "Went with competitor"), "Went with competitor");
assert.equal(resolveLostReason("lost", undefined, "Went with competitor"), "Went with competitor");
assert.equal(resolveLostReason("lost", "", null), null);
// Reopening or winning clears it, even if a reason is passed in.
assert.equal(resolveLostReason("open", "Price", "Went with competitor"), null);
assert.equal(resolveLostReason("won", undefined, "Went with competitor"), null);
// Unknown stage (label with no PipelineStage row) is treated as not-lost.
assert.equal(resolveLostReason(undefined, "Price", "Went with competitor"), null);

console.log("deal-fields tests passed");
