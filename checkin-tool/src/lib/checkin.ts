import fs from "fs";
import path from "path";

// The raw shape of a row from members.csv
export type Member = {
  member_id: number;
  full_name: string;
  age: number;
  preferred_channel: string;
  risk_flags: string[]; // parsing "lives_alone;recent_discharge" into ["lives_alone", "recent_discharge"]
};

// The raw shape of a row from last_contacts.csv
export type LastContact = {
  member_id: number;
  last_contact_utc: string; // utc is a string like "2025-10-30T14:48:00Z"
  outcome: string; // for example: "no_answer", "escalate", "contacted"
};

// the shape of the object returned by getDueMembers(), which is what the frontend gets from the API route and uses to render the UI
export type CheckinResult = {
  member_id: number;
  full_name: string;
  priority_score: number;
  recommended_window: "morning" | "afternoon";
  risk_flags: string[];
  days_since_contact: number | null;
  last_outcome: string | null;
  preferred_channel: string;
};

// this function converts a raw CSV string into an array of objects.
// The first row is treated as the header (column names).
function parseCsv(raw: string): Record<string, string>[] {
  const [headerLine, ...dataLines] = raw.trim().split("\n"); // split into lines and separate header from data
  const headers = headerLine.split(","); // break each line by commas to get individual values

  // Map each data line into an object where keys are from the header and values are from the line
  // for example, if header is "member_id,full_name,age" and a line is "1,Sarah Adler,82", we create { member_id: "1", full_name: "Sarah Adler", age: "82" }
  return dataLines.map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header.trim()] = (values[i] ?? "").trim();
    });
    return row;
  });
}

// this function reads and parses 'members.csv' into typed 'Member' objects
function loadMembers(): Member[] {
  const filePath = path.join(process.cwd(), "data", "members.csv");
  const raw = fs.readFileSync(filePath, "utf-8");

  // we use the parseCsv function to convert the raw CSV string into an array of objects,
  return parseCsv(raw).map((row) => ({
    member_id: Number(row["member_id"]),
    full_name: row["full_name"],
    age: Number(row["age"]),
    preferred_channel: row["preferred_channel"],
    risk_flags: row["risk_flags"]
      ? row["risk_flags"].split(";").map((f) => f.trim())
      : [],
  }));
}

// this function reads and parses 'last_contacts.csv' into typed 'LastContact' objects
function loadLastContacts(): LastContact[] {
  const filePath = path.join(process.cwd(), "data", "last_contacts.csv");
  const raw = fs.readFileSync(filePath, "utf-8");

  return parseCsv(raw).map((row) => ({
    member_id: Number(row["member_id"]),
    last_contact_utc: row["last_contact_utc"],
    outcome: row["outcome"],
  }));
}

// this function reads and parses 'holidays.json' into an array of date strings
function loadHolidays(): string[] {
  const filePath = path.join(process.cwd(), "data", "holidays.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// this function calculates the priority score for a single member
function calcPriorityScore(
  member: Member,
  lastContact: LastContact | undefined,
  today: Date
): number {
  let score = 0;

  // +3 if member is recently discharged
  if (member.risk_flags.includes("recent_discharge")) score += 3;

  // +2 if member lives alone
  if (member.risk_flags.includes("lives_alone")) score += 2;

  // +1 if member age is 80 or older
  if (member.age >= 80) score += 1;

  // +1 if member's 'last contact' outcome was 'no_answer'
  if (lastContact?.outcome === "no_answer") score += 1;

  // bonus points for time since the member was last contacted (fractional bonus for longer gaps)
  // +days_since_last_contact / 7
  if (lastContact) {
    const lastDate = new Date(lastContact.last_contact_utc); // convert the 'last contact' time from string to 'Date' object
    const diffMs = today.getTime() - lastDate.getTime(); // calculate the difference in milliseconds between today and the last contact date
    const diffDays = diffMs / (1000 * 60 * 60 * 24); // convert the calculated difference from milliseconds to days
    score += diffDays / 7; 
  }
  // NOTE: if no contact record at all, we still qualify them but add no gap bonus (we handle this in the main function)

  return Math.round(score * 10) / 10; // round to 1 decimal place
}

// Main function (called by the API route)
// this function returns the top N members due for a check-in today
/**
 * Returns the top N members due for a check-in today
 * @param top // how many members to return
 * @param dateOverride // optional override for "today's date" in YYYY-MM-DD format, used for testing different scenarios without changing the system clock
 * @returns // an array of members who are due for check-in, sorted by priority score (highest first)
 */
export function getDueMembers(top: number, dateOverride?: string): CheckinResult[] {
  // Use the override date if provided, otherwise default to 2025-11-06
  const today = dateOverride ? new Date(dateOverride) : new Date("2025-11-06");
  const todayStr = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Load all data
  const members = loadMembers(); // load members from members.csv using the loadMembers helper function
  const lastContacts = loadLastContacts(); // load last contact records from last_contacts.csv using the loadLastContacts helper function
  const holidays = loadHolidays(); // load holiday dates from holidays.json using the loadHolidays helper function

  // 1st qualification rule check:
  // today is not a holiday (based on holidays.json).
  if (holidays.includes(todayStr)) return [];

  // build a lookup map: member_id → their last contact record
  // we do this for better time complexity when we need to find the last contact for each member later.
  const contactMap = new Map<number, LastContact>();
  lastContacts.forEach((c) => contactMap.set(c.member_id, c));

  const results: CheckinResult[] = [];

  for (const member of members) { // iterate through each member
    
    // 2nd qualification rule check:
    // their preferred communication channel exists.
    if (!member.preferred_channel) continue;

    // look up the member's last contact record (if any) using the contactMap we built earlier
    const lastContact = contactMap.get(member.member_id);

    // 3rd qualification rule check:
    // they haven’t been contacted for at least 7 days (or have no record yet).
    if (lastContact) {
      const lastDate = new Date(lastContact.last_contact_utc);
      const diffMs = today.getTime() - lastDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 7) continue; // if its been less than 7 days since last contact, skip this member (not due yet)
    }
    // !: if no contact record at all, they automatically qualify

    const priority_score = calcPriorityScore(member, lastContact, today); // calculate the member's priority score using the calcPriorityScore helper function
    const recommended_window = member.age >= 80 ? "morning" : "afternoon"; // recommend morning check-ins for members 80 or older, afternoon for everyone else

    // build the result 'CheckinResult' object for current member and add it to the results array
    results.push({
        member_id: member.member_id,
        full_name: member.full_name,
        priority_score, // use the calculated priority score
        recommended_window, // use the determined recommended window (morning vs afternoon)
        risk_flags: member.risk_flags, // pass through the member's risk flags from the original data
        days_since_contact: lastContact 
            ? Math.floor(
                (today.getTime() - new Date(lastContact.last_contact_utc).getTime()) /
                (1000 * 60 * 60 * 24)
            )
            : null,
        last_outcome: lastContact?.outcome ?? null, // if there is a last contact record, use its outcome; otherwise null
        preferred_channel: member.preferred_channel, // pass through the member's preferred communication channel from the original data
    });
  }

  // sort descending by priority score, then return the top N
  results.sort((a, b) => b.priority_score - a.priority_score);
  return results.slice(0, top);
}