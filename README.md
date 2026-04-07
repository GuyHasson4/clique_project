# Clique — Check-in Tool

A web-based tool that helps community coordinators see which members need a check-in today, sorted by priority.

---

## How to run

**Prerequisites:** Node.js 18+ and npm 9+

Full system requirements are listed in [`checkin-tool/requirements.txt`](./checkin-tool/requirements.txt).
If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/en/download) — npm is bundled with it.

Navigate to the `checkin-tool` folder and run:

**PowerShell or Bash:**
```
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The API is also available directly at:
```
GET http://localhost:3000/api/due?top=5
GET http://localhost:3000/api/due?top=5&date=2025-11-08
```
The `date` parameter is optional — it overrides "today" for testing different scenarios.

**To run tests:**

PowerShell or Bash:
```
npm test
```

---

## Assumptions

**Current date is hardcoded to `2025-11-06`.**
Since the data in `last_contacts.csv` is from late October 2025, using the real system date (2026) would make every member overdue by hundreds of days and produce unrealistic scores. The default date was chosen to reflect a realistic "day after the data was recorded" scenario. The `dateOverride` parameter in `getDueMembers()` and the `?date=` query param in the API allow any date to be passed in — used extensively in the tests.

**7-day threshold uses exact hours, not calendar days.**
A member last contacted on `2025-10-30T08:00:00Z` is not yet due on `2025-11-06T00:00:00Z` (only 6.67 days). The cutoff is strict: `diffDays < 7` filters them out. This avoids ambiguity and is consistent with how the assignment specifies it.

**Members with an empty `preferred_channel` field are excluded.**
The assignment states the channel must exist. An empty string is treated as missing.

**`days_since_contact` in the result is floored, not rounded.**
Shown as a whole number in the UI (e.g. "9 days"), calculated with `Math.floor` for clarity.

**The `risk_flags` field is parsed by splitting on `;`.**
`"lives_alone;recent_discharge"` → `["lives_alone", "recent_discharge"]`. Leading/trailing whitespace is trimmed.

**Priority score is rounded to 1 decimal place.**
The fractional `days/7` bonus can produce long decimals — rounding keeps the display clean.

**No database — data is read from CSV/JSON files on every request.**
Appropriate for the scope of this assignment. File reads are synchronous and fast for small datasets.

---

## What I would improve with more time

- **Use the real date** — right now the date is hardcoded to match the sample data. I would switch to the actual current date and keep the data files updated to date alongside it.
- **Mark a member as contacted** — after making a call, the coordinator should be able to mark it as 'done' so the member disappears from the list.
- **Add a notes field** — a simple text box per member where the coordinator can add their remarks about the member condition and status from the last call.
- **Show the holiday name** — when there are no check-ins because of a holiday, it would be nicer to say "Today is Thanksgiving" rather than just "Today is a holiday".
- **Make it work on mobile** — the current layout is built for a desktop screen. Some parts would need to be rethought for smaller screens.
- **Support larger member lists** — returning only the top 5 is fine for the demo, but a real community could have many more members. I would add a way to browse through pages or a "load more" option. Also for more members I would add option to search by member names / IDs and sorting options (for example: to sort by recommended window, so morning slots will appear first).
