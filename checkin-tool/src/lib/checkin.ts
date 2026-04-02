// The raw shape of a row from members.csv
export type Member = {
  member_id: number;
  full_name: string;
  age: number;
  preferred_channel: string;
  risk_flags: string[]; // we'll parse "lives_alone;recent_discharge" into an array
};

// The raw shape of a row from last_contacts.csv
export type LastContact = {
  member_id: number;
  last_contact_utc: string;
  outcome: string;
};

// The final shape of each result row we return
export type CheckinResult = {
  member_id: number;
  full_name: string;
  priority_score: number;
  recommended_window: "morning" | "afternoon";
};