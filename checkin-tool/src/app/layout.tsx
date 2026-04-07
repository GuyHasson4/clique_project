import type { Metadata } from "next"; // bring in rules for the site's background info
import { DM_Sans } from "next/font/google"; // grab the dm sans font from google

// set up our font configuration
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"], // pick the exact font thicknesses we need
  variable: "--font-dm-sans", // create a custom css variable to use in styling
});

// this holds the data for browser tabs and search engines
export const metadata: Metadata = {
  title: "Clique's check-in", // the name of our tool, which will show up in browser tabs
  description: "A tool for community coordinators to see which members need a check-in today.",
  icons: { // point to the tiny logo files
    icon: "/logo.svg", // the standard little icon in the browser tab
    shortcut: "/logo.svg", // the icon used for bookmarks
    apple: "/logo.svg",  // the icon used if saved to an iphone home screen
  },
};

// this is the master blueprint wrapping every page
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // tell typescript what the content should look like
}>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
