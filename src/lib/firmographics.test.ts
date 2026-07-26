import assert from "node:assert/strict";
import {
  parseRevenueAmount,
  revenueRangeFor,
  deriveRevenueRange,
  employeeBucketLabel,
  employeeCountFromBucketLabel,
  parseEmployeeCountInput,
  withCurrent,
} from "./firmographics";

// Plain numbers and separators.
{
  assert.equal(parseRevenueAmount("5000000"), 5_000_000);
  assert.equal(parseRevenueAmount("1,200,000"), 1_200_000);
  assert.equal(parseRevenueAmount("  750  "), 750);
}

// Suffixes, case-insensitive, with and without currency symbols.
{
  assert.equal(parseRevenueAmount("$2.5M"), 2_500_000);
  assert.equal(parseRevenueAmount("2.5m"), 2_500_000);
  assert.equal(parseRevenueAmount("€3M"), 3_000_000);
  assert.equal(parseRevenueAmount("£1.2B"), 1_200_000_000);
  assert.equal(parseRevenueAmount("750k"), 750_000);
}

// A pre-bucketed range takes its lower bound, so "$1M-$5M" round-trips to the same bucket.
{
  assert.equal(parseRevenueAmount("$1M-$5M"), 1_000_000);
  assert.equal(deriveRevenueRange("$1M-$5M"), "$1M-$5M", "an existing bucket label stays put");
  assert.equal(deriveRevenueRange("$10M-$50M"), "$10M-$50M");
}

// Unparseable input must yield null, never a wrong guess or a zero.
{
  assert.equal(parseRevenueAmount(null), null);
  assert.equal(parseRevenueAmount(""), null);
  assert.equal(parseRevenueAmount("   "), null);
  assert.equal(parseRevenueAmount("confidential"), null);
  assert.equal(parseRevenueAmount("~2.5M"), null, "leading noise is not silently stripped");
  assert.equal(parseRevenueAmount("N/A"), null);
  assert.equal(deriveRevenueRange("unknown"), null);
}

// Bucket boundaries: each bound is exclusive at the top.
{
  assert.equal(revenueRangeFor(0), "<$1M");
  assert.equal(revenueRangeFor(999_999), "<$1M");
  assert.equal(revenueRangeFor(1_000_000), "$1M-$5M", "exactly 1M lands in the 1-5M bucket");
  assert.equal(revenueRangeFor(4_999_999), "$1M-$5M");
  assert.equal(revenueRangeFor(5_000_000), "$5M-$10M");
  assert.equal(revenueRangeFor(50_000_000), "$50M-$100M");
  assert.equal(revenueRangeFor(999_999_999), "$500M-$1B");
  assert.equal(revenueRangeFor(1_000_000_000), "$1B+", "the top bucket is open-ended");
  assert.equal(revenueRangeFor(50_000_000_000), "$1B+");
}

// Negative or nonsense amounts don't get a bucket.
{
  assert.equal(revenueRangeFor(null), null);
  assert.equal(revenueRangeFor(-1), null);
  assert.equal(revenueRangeFor(NaN), null);
}

// End-to-end: the shapes a rep actually types.
{
  assert.equal(deriveRevenueRange("$2.5M"), "$1M-$5M");
  assert.equal(deriveRevenueRange("12000000"), "$10M-$50M");
  assert.equal(deriveRevenueRange("$850k"), "<$1M");
  assert.equal(deriveRevenueRange("3.2B"), "$1B+");
}

// Employee buckets: an exact count maps to the bucket that contains it.
{
  assert.equal(employeeBucketLabel(1), "1-10");
  assert.equal(employeeBucketLabel(320), "201-500");
  assert.equal(employeeBucketLabel(10_000), "5,001-10,000");
  assert.equal(employeeBucketLabel(99_999), "10,001+", "open-ended top bucket");
  assert.equal(employeeBucketLabel(null), "");
  assert.equal(employeeBucketLabel(0), "", "0 is below the smallest bucket");
}

// Picking a bucket stores its lower bound — a range can't recover an exact headcount.
{
  assert.equal(employeeCountFromBucketLabel("201-500"), 201);
  assert.equal(employeeCountFromBucketLabel("10,001+"), 10_001);
  assert.equal(employeeCountFromBucketLabel("nonsense"), null);
}

// The shared input parser accepts bucket labels, plain numbers, and separators.
{
  assert.equal(parseEmployeeCountInput("201-500"), 201, "bucket label");
  assert.equal(parseEmployeeCountInput("320"), 320, "plain number wins over any bucket");
  assert.equal(parseEmployeeCountInput("1,250"), 1250);
  assert.equal(parseEmployeeCountInput(450), 450, "already a number");
  assert.equal(parseEmployeeCountInput(""), null);
  assert.equal(parseEmployeeCountInput(null), null);
  assert.equal(parseEmployeeCountInput("lots"), null, "unparseable is null, not 0");
  assert.equal(parseEmployeeCountInput("-5"), null, "negative rejected");
}

// A bucket label round-trips through store → display without drifting.
{
  const stored = parseEmployeeCountInput("201-500");
  assert.equal(employeeBucketLabel(stored), "201-500");
}

// withCurrent keeps a stored value that isn't curated, so imported data stays selectable.
{
  assert.deepEqual(withCurrent(["A", "B"], "B"), ["A", "B"], "already present, no duplicate");
  assert.deepEqual(withCurrent(["A", "B"], "Zebra"), ["A", "B", "Zebra"]);
  assert.deepEqual(withCurrent(["A"], null), ["A"]);
  assert.deepEqual(withCurrent(["A"], ""), ["A"]);
}

console.log("firmographics: all assertions passed");
