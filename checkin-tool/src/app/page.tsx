"use client"; // this page runs in the browser (needed for hooks)

import { useEffect, useState } from "react"; // react hooks for state and side effects

// this type describes one member record returned by /api/due
type CheckinResult = {
  member_id: number;
  full_name: string;
  priority_score: number;
  recommended_window: "morning" | "afternoon";
  risk_flags: string[];
  days_since_contact: number | null;
  last_outcome: string | null;
  preferred_channel: string;
};

// turns a member's full name into initials, like "sarah adler" -> "SA"
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// urgency thresholds — adjust these two numbers to change what counts as urgent vs moderate vs routine.
// scores >= URGENT_MIN are urgent, >= MODERATE_MIN (and < URGENT_MIN) are moderate, below that is routine.
const URGENT_MIN = 6;
const MODERATE_MIN = 3;

// sanity check to make sure the thresholds are set up correctly and won't produce any unexpected results in the UI
if (MODERATE_MIN >= URGENT_MIN) {
  throw new Error(`MODERATE_MIN (${MODERATE_MIN}) must be less than URGENT_MIN (${URGENT_MIN})`);
}

// converts a numeric score into a label + row/avatar colors for the UI
function getUrgency(score: number): { label: string; border: string; avatarBg: string } {
  if (score >= URGENT_MIN)   return { label: "Urgent",   border: "#f5a3a3", avatarBg: "#FDE8E8" };
  if (score >= MODERATE_MIN) return { label: "Moderate", border: "#f5c87a", avatarBg: "#FEF3E2" };
  return                            { label: "Routine",  border: "#8fcfaa", avatarBg: "#E8F5EE" };
}

// formats today's date for display above the title, e.g. "Wednesday, November 6"
function formatTodayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// main page component
export default function Home() {
  const [results, setResults] = useState<CheckinResult[]>([]); // stores the member list from the api
  const [loading, setLoading] = useState(true); // true while the first fetch (the API call to /api/due) is in progress
  const [isHoliday, setIsHoliday] = useState(false); // true when api returns empty list for holiday
  const [error, setError] = useState<string | null>(null); // stores any error messages from the API if the request fails
  const [expandedId, setExpandedId] = useState<number | null>(null); // keeps track of which member card is open

  const expandedMember = results.find((r) => r.member_id === expandedId) ?? null; // gets the selected member object for the currently open card, or null

  // fetch the top 5 members due for a check-in from the API on page load
  useEffect(() => {
    fetch("/api/due?top=5") // asks backend for top 5 due member
      .then((res) => res.json()) // converts the response into JSON
      .then((data) => { // handles successful json parsing
        if (data?.error) { // checks if backend sent an error payload
          setError(data.error); // if so, saves backend error text
        } else { // handles successful response
          setIsHoliday(Array.isArray(data) && data.length === 0); // if empty list, it's a holiday, otherwise save the results
          setResults(data); // saves returned members into state
        }
        setLoading(false); // marks loading as finished either way
      })
      .catch(() => { // handles network or parsing failures
        setError("Something went wrong. Please try again."); // shows generic fallback error
        setLoading(false); // stops loading spinner on failure
      });
  }, []);

  // sets up keyboard shortcut behavior for the detail cards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpandedId(null); };  // closes open card on escape
    window.addEventListener("keydown", onKey); // starts listening for key presses
    return () => window.removeEventListener("keydown", onKey); // cleans up the event listener when the component unmounts
  }, []);

  // counts used in the summary line below the title
  // counts per urgency level, using the same thresholds as getUrgency() so they never drift apart
  const urgent   = results.filter((r) => r.priority_score >= URGENT_MIN).length; // counts high urgency members
  const moderate = results.filter((r) => r.priority_score >= MODERATE_MIN && r.priority_score < URGENT_MIN).length; // counts moderate urgency members
  const routine  = results.filter((r) => r.priority_score < MODERATE_MIN).length; // counts routine urgency members

  return (
    <main style={{ fontFamily: "var(--font-dm-sans), sans-serif", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* quick hover polish for the menu button */}
      <style>{`
        .member-menu-btn { transition: background 0.15s, transform 0.15s; }
        .member-menu-btn:hover { background: #d8d8f0 !important; transform: scale(1.15); }
        .menu-dots { display: inline-block; }
      `}</style>

      {/* top header with logo and right-side controls */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1.5px solid #1a1a1a",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="clique" style={{ height: "30px", width: "auto", display: "block" }} />
          <span style={{ fontWeight: 300, fontSize: "18px", color: "#555" }}>/ Check-in</span>
        </div>
        {/* language label and menu icon placeholders */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "14px", color: "#333", display: "flex", alignItems: "center", gap: "4px" }}>
            EN <span style={{ fontSize: "10px" }}>∨</span>
          </span>
          <span style={{ fontSize: "18px", color: "#333", letterSpacing: "1px" }}>≡</span>
        </div>
      </header>

      {/* page body with sidebar on the left and content on the right */}
      <div style={{ display: "flex", flex: 1 }}>

        {/* left nav rail with placeholder items */}
        <nav style={{
          width: "220px",
          flexShrink: 0,
          background: "#fff",
          borderRight: "1.5px solid #1a1a1a",
          padding: "32px 0",
        }}>
          {/* inactive nav row */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 24px",
            fontWeight: 400, fontSize: "14px", color: "#555", cursor: "default",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="5" r="3" stroke="#555" strokeWidth="1.3"/>
              <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="#555" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Your community
          </div>

          {/* active nav row with a left border to show current page */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 24px",
            fontWeight: 700, fontSize: "14px", color: "#1a1a1a", cursor: "default",
            borderLeft: "3px solid #1a1a1a",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="2.5,8 6,11.5 13.5,4" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Check-in Tool
          </div>

          {/* another inactive nav row */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 24px",
            fontWeight: 400, fontSize: "14px", color: "#555", cursor: "default",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="1.5" width="10" height="13" rx="1" stroke="#555" strokeWidth="1.3"/>
              <line x1="5.5" y1="5.5" x2="10.5" y2="5.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="5.5" y1="8" x2="10.5" y2="8" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Reports &amp; overview
          </div>
        </nav>

        {/* main content panel */}
        <div style={{ flex: 1, padding: "48px 56px 72px" }}>

        {/* date shown above the title */}
        <p style={{ fontSize: "13px", fontWeight: 300, color: "#999", margin: "0 0 8px", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          {formatTodayLong()}
        </p>

        <h1 style={{ fontSize: "48px", fontWeight: 700, margin: "0", letterSpacing: "-0.5px", lineHeight: 1.08 }}>
          Today&apos;s check-ins
        </h1>

        {/* brief count of members by urgency level, shown once data is loaded */}
        {!loading && !isHoliday && results.length > 0 && (
          <p style={{ fontSize: "14px", fontWeight: 400, color: "#555", margin: "12px 0 0" }}>
            {results.length} member{results.length !== 1 ? "s" : ""} need your attention today
            {urgent > 0 && <> — {urgent} urgent</>}
            {moderate > 0 && <>, {moderate} moderate</>}
            {routine > 0 && <>, {routine} routine</>}
          </p>
        )}

        {/* fallback subtitle shown while loading or when no results are expected */}
        {(loading || isHoliday || results.length === 0) && (
          <p style={{ fontSize: "14px", fontWeight: 400, color: "#555", margin: "12px 0 0" }}>
            Members due for a call, sorted by priority
          </p>
        )}

        <div style={{ borderBottom: "1px solid #ddd", margin: "24px 0 20px" }} />

        <p style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px", color: "#1a1a1a" }}>
          All members
        </p>

        {/* four possible states: loading, error, holiday, or the member list */}
        {loading ? (
          <p style={{ padding: "40px 0", color: "#aaa", fontSize: "15px", fontWeight: 300 }}>Loading...</p>
        ) : error ? (
          <div style={{ padding: "64px 0" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</p>
            <p style={{ color: "#888", fontSize: "14px", fontWeight: 300, margin: 0 }}>{error}</p>
          </div>
        ) : isHoliday ? (
          <div style={{ padding: "64px 0" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px" }}>No check-ins today</p>
            <p style={{ color: "#888", fontSize: "14px", fontWeight: 300, margin: 0 }}>Today is a holiday — the team is off.</p>
          </div>
        ) : results.length === 0 ? (
          <p style={{ padding: "40px 0", color: "#aaa", fontSize: "15px", fontWeight: 300 }}>
            No members are due for a check-in today.
          </p>
        ) : (
          results.map((member) => { // loop through each member and render one row
            const urgency = getUrgency(member.priority_score); // compute label + colors from score
            return (
              // left border color signals urgency at a glance
              <div key={member.member_id} style={{ borderLeft: `4px solid ${urgency.border}`, paddingLeft: "16px" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "18px 0",
                  gap: "16px",
                }}>
                  {/* show avatar + member id as a fixed left column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", flexShrink: 0 }}> {/* stack avatar above id */}
                    <div style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: urgency.avatarBg,
                      color: "#1a1a1a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                    }}>
                      {getInitials(member.full_name)} {/* render initials inside the avatar from the member's full name */}
                    </div>
                    <div style={{ fontSize: "10px", fontWeight: 300, color: "#bbb", letterSpacing: "0.3px" }}>
                      #{member.member_id}
                    </div>
                  </div>

                  {/* member name takes up the remaining space */}
                  <div style={{ flex: 1, fontWeight: 600, fontSize: "16px", color: "#1a1a1a" }}>
                    {member.full_name}
                  </div>

                  {/* urgency pill */}
                  <div style={{
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    padding: "3px 12px",
                    fontSize: "13px",
                    fontWeight: 400,
                    color: "#333",
                    flexShrink: 0,
                  }}>
                    {urgency.label}
                  </div>

                  {/* best time of day to reach this member */}
                  <div style={{ fontSize: "14px", color: "#555", flexShrink: 0, minWidth: "80px", textAlign: "right", textTransform: "capitalize" }}>
                    {member.recommended_window}
                  </div>

                  {/* numeric priority score, higher means more urgent */}
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a1a", flexShrink: 0, minWidth: "40px", textAlign: "right" }}>
                    {member.priority_score}
                  </div>

                  {/* opens the detail card for this member */}
                  <div
                    onClick={() => setExpandedId(member.member_id)}
                    className="member-menu-btn"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#eef",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: "11px",
                      color: "#555",
                      cursor: "pointer",
                    }}>
                    <span className="menu-dots">···</span>
                  </div>
                </div>

                <div style={{ borderBottom: "1px solid #e8e8e8" }} />
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* detail card overlay, shown when a member's menu button is clicked */}
      {expandedMember && (() => {
        const u = getUrgency(expandedMember.priority_score);
        // human-readable versions of the raw flag and outcome values
        const flagLabels: Record<string, string> = {
          lives_alone: "Lives alone",
          recent_discharge: "Recent discharge",
        };
        const outcomeLabels: Record<string, string> = {
          ok: "OK",
          no_answer: "No answer",
          escalate: "Escalated",
        };
        return (
          <>
            {/* clicking the backdrop closes the card */}
            <div
              onClick={() => setExpandedId(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 100 }}
            />

            <div style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "400px",
              borderRadius: "12px",
              padding: "32px",
              background: "#fff",
              boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
              // top border matches the urgency color of this member's row
              borderTop: `4px solid ${u.border}`,
              zIndex: 101,
            }}>
              {/* card header: avatar + name + urgency pill */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: u.avatarBg, color: "#1a1a1a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", fontWeight: 700, flexShrink: 0,
                }}>
                  {getInitials(expandedMember.full_name)}
                </div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a", marginBottom: "6px" }}>
                    {expandedMember.full_name}
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    border: "1px solid #ddd", borderRadius: "4px",
                    padding: "2px 10px", fontSize: "12px", color: "#333",
                  }}>
                    {u.label} <span style={{ fontSize: "9px", color: "#aaa" }}>∨</span>
                  </div>
                </div>
              </div>

              {/* 2-column grid of labeled fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 16px", marginTop: "28px" }}>
                {[
                  ["Member ID",           `#${expandedMember.member_id}`],
                  ["Priority score",      String(expandedMember.priority_score)],
                  ["Days since contact",  expandedMember.days_since_contact !== null ? `${expandedMember.days_since_contact} days` : "Never contacted"],
                  ["Recommended window",  expandedMember.recommended_window.charAt(0).toUpperCase() + expandedMember.recommended_window.slice(1)],
                  ["Preferred channel",   expandedMember.preferred_channel.charAt(0).toUpperCase() + expandedMember.preferred_channel.slice(1)],
                  ["Last outcome",        outcomeLabels[expandedMember.last_outcome ?? ""] ?? "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: "11px", fontWeight: 400, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a1a" }}>
                      {value}
                    </div>
                  </div>
                ))}

                {/* risk flags span both columns, each flag shown as a small pill */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: "11px", fontWeight: 400, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                    Risk flags
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {expandedMember.risk_flags.length > 0
                      ? expandedMember.risk_flags.map((f) => (
                          <span key={f} style={{ background: "#f3f3f3", borderRadius: "4px", padding: "2px 8px", fontSize: "12px", color: "#555" }}>
                            {flagLabels[f] ?? f}
                          </span>
                        ))
                      : <span style={{ fontSize: "13px", color: "#bbb" }}>None</span>
                    }
                  </div>
                </div>
              </div>

              {/* close button */}
              <div style={{ textAlign: "right", marginTop: "28px" }}>
                <span
                  onClick={() => setExpandedId(null)}
                  style={{ fontSize: "13px", color: "#aaa", cursor: "pointer" }}
                >
                  ✕ Close
                </span>
              </div>
            </div>
          </>
        );
      })()}
    </main>
  );
}
