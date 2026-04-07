import { getDueMembers, CheckinResult } from "../lib/checkin";

let passed = 0; // tracks passing tests
let failed = 0; // tracks failing tests
let testCount = 0; // tracks test number for labeling

// tiny local test runner, no framework needed
function test(name: string, fn: () => void) { // receives a test name and callback
  testCount++;
  console.log(`\ntest ${testCount}:`); // prints test number before running
  try {
    fn(); // runs the test body
    console.log(`  PASS  ${name}`); // logs pass result with test name
    passed++; // increments pass count
  } catch (e: unknown) {
    console.log(`  FAIL  ${name}`); // logs fail result with test name
    console.log(`        ${e instanceof Error ? e.message : e}`); // prints readable error text
    failed++; // increments fail count
  }
}

function assert(condition: boolean, message: string) { // throws when condition is false
  if (!condition) throw new Error(message); // keeps assertions simple and explicit
}

// prints each call and its returned rows in a compact view
function logResults(date: string, top: number, results: CheckinResult[]) { // helper for readable test output
  console.log(`        input:  getDueMembers(${top}, "${date}")`); // shows function input
  console.log(`        output: ${results.length} result(s)`); // shows row count
  if (results.length > 0) { // only prints details when rows exist
    for (const r of results) { // iterates each returned member
      console.log(
        `          → #${r.member_id} ${r.full_name.padEnd(14)} ` + // id and name
        `score=${r.priority_score}  window=${r.recommended_window}  ` + // score and preferred time window
        `days=${r.days_since_contact ?? "N/A"}  outcome=${r.last_outcome ?? "N/A"}  ` + // last-contact context
        `flags=[${r.risk_flags.join(", ")}]`
      ); // risk flags list
    }
  }
}

console.log("\nCheck-in Tool — Tests\n");

// Test 1: all 4 members are overdue on Nov 8 and should be returned sorted by priority
test("returns all qualified members sorted by priority (date: 2025-11-08)", () => {
  const results = getDueMembers(10, "2025-11-08"); // asks for up to 10 due members
  logResults("2025-11-08", 10, results); // prints rows for inspection
  assert(results.length === 4, `expected 4 results, got ${results.length}`); // verifies expected count
  assert(results[0].full_name === "Sarah Adler", `expected Sarah Adler first, got ${results[0].full_name}`); // verifies top ranking
  for (let i = 1; i < results.length; i++) { // checks non-increasing score order
    assert(
      results[i - 1].priority_score >= results[i].priority_score,
      `results not sorted: ${results[i - 1].priority_score} should be >= ${results[i].priority_score}`
    );
  }
});

// Test 2: Nov 7 is in holidays.json — no check-ins allowed
test("returns empty array on a holiday (date: 2025-11-07)", () => {
  const results = getDueMembers(10, "2025-11-07"); // holiday date input
  logResults("2025-11-07", 10, results); // prints returned rows
  assert(results.length === 0, `expected 0 results on holiday, got ${results.length}`); // verifies holiday guard
});

// Test 3: on Oct 31, only Danny was contacted 11+ days ago — the rest are under 7 days
test("filters out recently contacted members (date: 2025-10-31)", () => {
  const results = getDueMembers(10, "2025-10-31"); // non-holiday date input
  logResults("2025-10-31", 10, results); // prints returned rows
  assert(results.length === 1, `expected 1 result, got ${results.length}`); // verifies only one member due
  assert(results[0].full_name === "Danny Israel", `expected Danny Israel, got ${results[0].full_name}`); // checks expected member
});

// Test 4: the top parameter should cap the number of results returned
test("top parameter limits number of results", () => {
  const results = getDueMembers(2, "2025-11-08"); // asks for only two rows
  logResults("2025-11-08", 2, results); // prints returned rows
  assert(results.length === 2, `expected 2 results, got ${results.length}`); // verifies top limit
});

// Test 5: verify Sarah's score — recent_discharge(+3) + lives_alone(+2) + age>=80(+1) + days/7
test("calculates correct priority score for Sarah Adler", () => {
  const results = getDueMembers(10, "2025-11-08"); // gets rows for scoring check
  const sarah = results.find((r) => r.member_id === 3)!; // finds sarah by id
  console.log(`        input:  Date: 2025-11-08; Sarah Adler flags=[recent_discharge, lives_alone], age=90`); // logs score inputs
  console.log(`        calc:   +3 (recent_discharge) +2 (lives_alone) +1 (age>=80) +${sarah.days_since_contact}days/7 = ${sarah.priority_score}`); // logs expected formula
  assert(sarah.priority_score === 7.7, `expected 7.7, got ${sarah.priority_score}`); // verifies exact score
});

// Test 6: members aged 80+ should get "morning", others "afternoon"
test("recommends morning for age 80+ and afternoon for under 80", () => {
  const results = getDueMembers(10, "2025-11-08"); // gets rows for window checks
  const ruth = results.find((r) => r.member_id === 1)!; // retrieves ruth
  const joseph = results.find((r) => r.member_id === 2)!; // retrieves joseph
  const sarah = results.find((r) => r.member_id === 3)!; // retrieves sarah
  const danny = results.find((r) => r.member_id === 4)!; // retrieves danny
  console.log(`        Ruth (age 82)   → ${ruth.recommended_window}`); // logs ruth window
  console.log(`        Sarah (age 90)  → ${sarah.recommended_window}`); // logs sarah window
  console.log(`        Joseph (age 76) → ${joseph.recommended_window}`); // logs joseph window
  console.log(`        Danny (age 68)  → ${danny.recommended_window}`); // logs danny window
  assert(ruth.recommended_window === "morning", `Ruth (82) should be morning`); // checks 80+ behavior
  assert(sarah.recommended_window === "morning", `Sarah (90) should be morning`); // checks 80+ behavior
  assert(joseph.recommended_window === "afternoon", `Joseph (76) should be afternoon`); // checks under-80 behavior
  assert(danny.recommended_window === "afternoon", `Danny (68) should be afternoon`); // checks under-80 behavior
});

// Test 7: Joseph's last outcome is "no_answer", which should add +1 to his score
test("no_answer outcome adds +1 to priority score", () => {
  const results = getDueMembers(10, "2025-11-08"); // gets rows for outcome check
  const joseph = results.find((r) => r.member_id === 2)!; // finds joseph by id
  console.log(`        input:  Joseph Levi — last_outcome=${joseph.last_outcome}, age=76`); // logs score inputs
  console.log(`        calc:   +1 (no_answer) +${joseph.days_since_contact}days/7 = ${joseph.priority_score}`); // logs expected math
  assert(joseph.priority_score === 2.5, `expected 2.5, got ${joseph.priority_score}`); // checks exact score
  assert(joseph.last_outcome === "no_answer", `expected no_answer, got ${joseph.last_outcome}`); // confirms trigger condition
});

// Test 8: boundary — Danny's last contact is Oct 20 10:00 UTC
// on Oct 27 (6.58 days) he should NOT qualify, on Oct 28 (7.58 days) he should
test("7-day boundary: not due at 6.6 days, due at 7.6 days", () => {
  const before = getDueMembers(10, "2025-10-27"); // query just before threshold
  console.log(`        Oct 27 (6.58 days since Danny's last contact Oct 20 10:00):`); // logs boundary context
  logResults("2025-10-27", 10, before); // prints before-threshold rows
  const after = getDueMembers(10, "2025-10-28"); // query just after threshold
  console.log(`        Oct 28 (7.58 days since Danny's last contact Oct 20 10:00):`); // logs boundary context
  logResults("2025-10-28", 10, after); // prints after-threshold rows
  assert(before.length === 0, `expected 0 results on Oct 27, got ${before.length}`); // verifies not yet due
  assert(after.length === 1, `expected 1 result on Oct 28, got ${after.length}`); // verifies now due
  assert(after[0].full_name === "Danny Israel", `expected Danny Israel, got ${after[0].full_name}`); // verifies due member
});

// Test 9: Dec 25 is also in holidays.json — should return empty
test("returns empty on second holiday (date: 2025-12-25)", () => {
  const results = getDueMembers(10, "2025-12-25"); // second holiday date input
  logResults("2025-12-25", 10, results); // prints returned rows
  assert(results.length === 0, `expected 0 on Christmas, got ${results.length}`); // verifies holiday guard
});

// final summary and exit code
console.log(`\n${passed} passed, ${failed} failed\n`); // prints totals
if (failed > 0) process.exit(1); // returns non-zero when any test fails
