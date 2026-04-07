import { NextRequest, NextResponse } from "next/server"; // get the request and response tools from next.js
import { getDueMembers } from "@/lib/checkin"; // import the getDueMembers (main) function from our checkin library in order to determine which members need a check-in

// tell the server to run using node.js so it can read computer files
export const runtime = "nodejs";

// create the main handler to respond when someone asks for data from this url
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl; // grab any extra options the user added to the end of the url

  // extract query parameters from the request URL:
  const top = Number(searchParams.get("top") ?? "5"); // read how many top 'N' members the user ask for, default to 5 if not provided
  const date = searchParams.get("date") ?? undefined; // read the date parameter, if provided, otherwise leave it undefined to use the current date in the getDueMembers function
  
  try { // try to run the main logic safely
    const results = getDueMembers(top, date); // run the check-in logic to get the list of members, using the top and date parameters we extracted from the url
    return NextResponse.json(results); // package the calculated list into json and send it back to the user
  } catch (e) { // catch any errors if something goes wrong (for example: a missing file)
    console.error("Failed to load data files:", e); // log the exact error behind the scenes for debugging
    return NextResponse.json({ error: "Could not load data. Please check that the data files exist." }, { status: 500 }); // tell the user something broke with a standard 500 error code
  }
}